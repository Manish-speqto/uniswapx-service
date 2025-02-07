import Logger from 'bunyan'
import { Entity, Table } from 'dynamodb-toolbox'

import { TABLE_KEY } from '../config/dynamodb'
import { OrderEntity, ORDER_STATUS, SettledAmount, SORT_FIELDS } from '../entities'
import { GetOrdersQueryParams, GET_QUERY_PARAMS } from '../handlers/get-orders/schema'
import { log } from '../Logging'
import { checkDefined } from '../preconditions/preconditions'
import { ComparisonFilter, parseComparisonFilter } from '../util/comparison'
import { decode, encode } from '../util/encryption'
import { generateRandomNonce } from '../util/nonce'
import { currentTimestampInSeconds } from '../util/time'
import { BaseOrdersRepository, QueryResult } from './base'

export const MAX_ORDERS = 50
// Shared implementation for Dutch and Limit orders
// will work for orders with the same GSIs
export class GenericOrdersRepository<
  TableName extends string,
  PartitionKey extends string,
  SortKey extends string | null
> implements BaseOrdersRepository
{
  public constructor(
    private readonly table: Table<TableName, PartitionKey, SortKey>,
    private readonly entity: Entity,
    private readonly nonceEntity: Entity,
    private readonly log: Logger
  ) {}

  public async getByOfferer(
    offerer: string,
    limit: number,
    cursor?: string,
    sortKey?: SORT_FIELDS,
    sort?: string,
    desc?: boolean
  ): Promise<QueryResult> {
    return await this.queryOrderEntity(offerer, TABLE_KEY.OFFERER, limit, cursor, sortKey, sort, desc)
  }

  public async getByOrderStatus(
    orderStatus: string,
    limit: number,
    cursor?: string,
    sortKey?: SORT_FIELDS,
    sort?: string,
    desc?: boolean
  ): Promise<QueryResult> {
    return await this.queryOrderEntity(orderStatus, TABLE_KEY.ORDER_STATUS, limit, cursor, sortKey, sort, desc)
  }

  public async getByFiller(
    filler: string,
    limit: number,
    cursor?: string,
    sortKey?: SORT_FIELDS,
    sort?: string,
    desc?: boolean
  ): Promise<QueryResult> {
    return await this.queryOrderEntity(filler, TABLE_KEY.FILLER, limit, cursor, sortKey, sort, desc)
  }

  public async getByChainId(
    chainId: number,
    limit: number,
    cursor?: string,
    sortKey?: SORT_FIELDS,
    sort?: string,
    desc?: boolean
  ): Promise<QueryResult> {
    return await this.queryOrderEntity(chainId, TABLE_KEY.CHAIN_ID, limit, cursor, sortKey, sort, desc)
  }

  public async getByHash(hash: string): Promise<OrderEntity | undefined> {
    const res = await this.entity.get({ [TABLE_KEY.ORDER_HASH]: hash }, { execute: true })
    return res.Item as OrderEntity
  }

  public async getNonceByAddressAndChain(address: string, chainId: number): Promise<string> {
    const res = await this.nonceEntity.query(`${address}-${chainId}`, {
      limit: 1,
      reverse: true,
      consistent: true,
      execute: true,
    })
    if (res.Items && res.Items.length > 0) {
      return res.Items[0].nonce
    }
    return generateRandomNonce()
  }

  public async countOrdersByOffererAndStatus(offerer: string, orderStatus: ORDER_STATUS): Promise<number> {
    const res = await this.entity.query(`${offerer}_${orderStatus}`, {
      index: 'offerer_orderStatus-createdAt-all',
      execute: true,
      select: 'COUNT',
    })

    return res.Count || 0
  }

  public async putOrderAndUpdateNonceTransaction(order: OrderEntity): Promise<void> {
    await this.table.transactWrite(
      [
        this.entity.putTransaction({
          ...order,
          offerer_orderStatus: `${order.offerer}_${order.orderStatus}`,
          filler_orderStatus: `${order.filler}_${order.orderStatus}`,
          filler_offerer: `${order.filler}_${order.offerer}`,
          chainId_filler: `${order.chainId}_${order.filler}`,
          chainId_orderStatus: `${order.chainId}_${order.orderStatus}`,
          chainId_orderStatus_filler: `${order.chainId}_${order.orderStatus}_${order.filler}`,
          filler_offerer_orderStatus: `${order.filler}_${order.offerer}_${order.orderStatus}`,
          createdAt: currentTimestampInSeconds(),
        }),
        this.nonceEntity.updateTransaction({
          offerer: `${order.offerer}-${order.chainId}`,
          nonce: order.nonce,
        }),
      ],
      {
        capacity: 'total',
        execute: true,
      }
    )
  }

  public async updateOrderStatus(
    orderHash: string,
    status: ORDER_STATUS,
    txHash?: string,
    settledAmounts?: SettledAmount[]
  ): Promise<void> {
    try {
      const order = checkDefined(
        await this.getByHash(orderHash),
        'cannot find order by hash when updating order status'
      )

      await this.entity.update({
        [TABLE_KEY.ORDER_HASH]: orderHash,
        orderStatus: status,
        offerer_orderStatus: `${order.offerer}_${status}`,
        filler_orderStatus: `${order.filler}_${status}`,
        filler_offerer_orderStatus: `${order.filler}_${order.offerer}_${status}`,
        chainId_orderStatus: `${order.chainId}_${status}`,
        chainId_orderStatus_filler: `${order.chainId}_${status}_${order.filler}`,
        ...(txHash && { txHash }),
        ...(settledAmounts && { settledAmounts }),
      })
    } catch (e) {
      log.error('updateOrderStatus error', { error: e })
      throw e
    }
  }

  public async deleteOrders(orderHashes: string[]): Promise<void> {
    await this.table.batchWrite(
      orderHashes.map((hash) => this.entity.deleteBatch({ orderHash: hash })),
      { execute: true }
    )
  }

  public async getOrders(limit: number, queryFilters: GetOrdersQueryParams, cursor?: string): Promise<QueryResult> {
    const requestedParams = this.getRequestedParams(queryFilters)
    // Query Orders table based on the requested params
    switch (true) {
      case this.areParamsRequested(
        //map to the correct gsi
        [GET_QUERY_PARAMS.FILLER, GET_QUERY_PARAMS.OFFERER, GET_QUERY_PARAMS.ORDER_STATUS],
        requestedParams
      ):
        return await this.queryOrderEntity(
          `${queryFilters['filler']}_${queryFilters['offerer']}_${queryFilters['orderStatus']}`,
          `${TABLE_KEY.FILLER}_${TABLE_KEY.OFFERER}_${TABLE_KEY.ORDER_STATUS}`,
          limit,
          cursor, //encoded paging object
          queryFilters['sortKey'],
          queryFilters['sort'],
          queryFilters['desc']
        )

      case this.areParamsRequested([GET_QUERY_PARAMS.CHAIN_ID, GET_QUERY_PARAMS.FILLER], requestedParams):
        return await this.queryOrderEntity(
          `${queryFilters['chainId']}_${queryFilters['filler']}`,
          `${TABLE_KEY.CHAIN_ID}_${TABLE_KEY.FILLER}`,
          limit,
          cursor,
          queryFilters['sortKey'],
          queryFilters['sort'],
          queryFilters['desc']
        )

      case this.areParamsRequested([GET_QUERY_PARAMS.CHAIN_ID, GET_QUERY_PARAMS.ORDER_STATUS], requestedParams):
        return await this.queryOrderEntity(
          `${queryFilters['chainId']}_${queryFilters['orderStatus']}`,
          `${TABLE_KEY.CHAIN_ID}_${TABLE_KEY.ORDER_STATUS}`,
          limit,
          cursor,
          queryFilters['sortKey'],
          queryFilters['sort'],
          queryFilters['desc']
        )

      case this.areParamsRequested(
        [GET_QUERY_PARAMS.CHAIN_ID, GET_QUERY_PARAMS.ORDER_STATUS, GET_QUERY_PARAMS.FILLER],
        requestedParams
      ):
        return await this.queryOrderEntity(
          `${queryFilters['chainId']}_${queryFilters['orderStatus']}_${queryFilters['filler']}`,
          `${TABLE_KEY.CHAIN_ID}_${TABLE_KEY.ORDER_STATUS}_${TABLE_KEY.FILLER}`,
          limit,
          cursor,
          queryFilters['sortKey'],
          queryFilters['sort'],
          queryFilters['desc']
        )

      case this.areParamsRequested([GET_QUERY_PARAMS.FILLER, GET_QUERY_PARAMS.ORDER_STATUS], requestedParams):
        return await this.queryOrderEntity(
          `${queryFilters['filler']}_${queryFilters['orderStatus']}`,
          `${TABLE_KEY.FILLER}_${TABLE_KEY.ORDER_STATUS}`,
          limit,
          cursor,
          queryFilters['sortKey'],
          queryFilters['sort'],
          queryFilters['desc']
        )

      case this.areParamsRequested([GET_QUERY_PARAMS.FILLER, GET_QUERY_PARAMS.OFFERER], requestedParams):
        return await this.queryOrderEntity(
          `${queryFilters['filler']}_${queryFilters['offerer']}`,
          `${TABLE_KEY.FILLER}_${TABLE_KEY.OFFERER}`,
          limit,
          cursor,
          queryFilters['sortKey'],
          queryFilters['sort'],
          queryFilters['desc']
        )

      case this.areParamsRequested([GET_QUERY_PARAMS.OFFERER, GET_QUERY_PARAMS.ORDER_STATUS], requestedParams):
        return await this.queryOrderEntity(
          `${queryFilters['offerer']}_${queryFilters['orderStatus']}`,
          `${TABLE_KEY.OFFERER}_${TABLE_KEY.ORDER_STATUS}`,
          limit,
          cursor,
          queryFilters['sortKey'],
          queryFilters['sort'],
          queryFilters['desc']
        )

      case requestedParams.includes(GET_QUERY_PARAMS.ORDER_HASH): {
        const order = await this.getByHash(queryFilters['orderHash'] as string)
        return { orders: order ? [order] : [] }
      }

      case requestedParams.includes(GET_QUERY_PARAMS.ORDER_HASHES): {
        const orderHashes = queryFilters['orderHashes'] as string[]
        const batchQuery = await this.table.batchGet(
          orderHashes.map((orderHash) => this.entity.getBatch({ orderHash })),
          { execute: true }
        )
        const tableName = this.table.name
        return { orders: batchQuery.Responses[tableName] }
      }

      case this.areParamsRequested([GET_QUERY_PARAMS.OFFERER], requestedParams):
        return await this.getByOfferer(
          queryFilters['offerer'] as string,
          limit,
          cursor,
          queryFilters['sortKey'],
          queryFilters['sort'],
          queryFilters['desc']
        )

      case this.areParamsRequested([GET_QUERY_PARAMS.ORDER_STATUS], requestedParams):
        return await this.getByOrderStatus(
          queryFilters['orderStatus'] as string,
          limit,
          cursor,
          queryFilters['sortKey'],
          queryFilters['sort'],
          queryFilters['desc']
        )

      case this.areParamsRequested([GET_QUERY_PARAMS.FILLER], requestedParams):
        return await this.getByFiller(
          queryFilters['filler'] as string,
          limit,
          cursor,
          queryFilters['sortKey'],
          queryFilters['sort'],
          queryFilters['desc']
        )

      case this.areParamsRequested([GET_QUERY_PARAMS.CHAIN_ID], requestedParams):
        return await this.getByChainId(
          queryFilters['chainId'] as number,
          limit,
          cursor,
          queryFilters['sortKey'],
          queryFilters['sort'],
          queryFilters['desc']
        )

      default: {
        throw new Error(
          'Invalid query, must query with one of the following params: [orderHash, orderHashes, chainId, orderStatus, swapper, filler]'
        )
      }
    }
  }

  private async queryOrderEntity(
    partitionKey: string | number,
    index: string,
    limit: number | undefined,
    cursor?: string,
    sortKey?: SORT_FIELDS | undefined,
    sort?: string | undefined, // ex gt(123)
    desc = true
  ): Promise<QueryResult> {
    let comparison: ComparisonFilter | undefined = undefined
    if (sortKey) {
      comparison = parseComparisonFilter(sort)
    }
    const formattedIndex = `${index}-${sortKey ?? TABLE_KEY.CREATED_AT}-all`

    const queryResult = await this.entity.query(partitionKey, {
      index: formattedIndex,
      execute: true,
      limit: limit ? Math.min(limit, MAX_ORDERS) : MAX_ORDERS,
      ...(sortKey &&
        comparison && {
          [comparison.operator]: comparison.operator == 'between' ? comparison.values : comparison.values[0],
          reverse: desc,
        }),
      ...(cursor && { startKey: this.getStartKey(cursor, formattedIndex) }),
    })

    return {
      orders: queryResult.Items as OrderEntity[],
      ...(queryResult.LastEvaluatedKey && { cursor: encode(JSON.stringify(queryResult.LastEvaluatedKey)) }),
    }
  }

  private areParamsRequested(queryParams: GET_QUERY_PARAMS[], requestedParams: string[]): boolean {
    return (
      requestedParams.length == queryParams.length && queryParams.every((filter) => requestedParams.includes(filter))
    )
  }

  private getRequestedParams(queryFilters: GetOrdersQueryParams) {
    return Object.keys(queryFilters).filter((requestedParam) => {
      return ![GET_QUERY_PARAMS.SORT_KEY, GET_QUERY_PARAMS.SORT, GET_QUERY_PARAMS.DESC].includes(
        requestedParam as GET_QUERY_PARAMS
      )
    })
  }

  private getStartKey(cursor: string, index?: string) {
    let lastEvaluatedKey = []
    try {
      lastEvaluatedKey = JSON.parse(decode(cursor))
    } catch (e) {
      this.log.error('Error parsing json cursor.', { cursor, error: e })
      throw new Error('Invalid cursor.')
    }
    const keys = Object.keys(lastEvaluatedKey)
    const validKeys: string[] = [TABLE_KEY.ORDER_HASH]

    index
      ?.split('-')
      .filter((key) => Object.values<string>(TABLE_KEY).includes(key))
      .forEach((key: string) => {
        if (key) {
          validKeys.push(key)
        }
      })

    const keysMatch = keys.every((key: string) => {
      return validKeys.includes(key as TABLE_KEY)
    })

    if (keys.length != validKeys.length || !keysMatch) {
      this.log.error('Error cursor key not in valid key list.', { cursor })
      throw new Error('Invalid cursor.')
    }

    return lastEvaluatedKey
  }
}
