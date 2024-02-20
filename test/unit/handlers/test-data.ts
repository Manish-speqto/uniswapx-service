/* eslint-disable */
import { OrderType, REACTOR_ADDRESS_MAPPING } from '@uniswap/uniswapx-sdk'
import { OrderEntity, ORDER_STATUS } from '../../../lib/entities'

export const MOCK_ORDER_HASH = '0xc57af022b96e1cb0da0267c15f1d45cdfccf57cfeb8b33869bb50d7f478ab203'
export const MOCK_ENCODED_ORDER =
  '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000644844ea000000000000000000000000000000000000000000000000000000006448454e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000cf7ed3acca5a467e9e704c703e8d87f634fb0fc90000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f051200000000000000000000000079cbd6e23db4b71288d4273cfe9e4c6f729838900000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000006448454e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000dc64a140aa3e981100a9beca4e685f962f0cf6c90000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000c7d713b49da000000000000000000000000000079cbd6e23db4b71288d4273cfe9e4c6f72983890'
export const MOCK_SIGNATURE =
  '0x5cb4a416206783ec0939d40258f7ed6f2b3d68cb5e3645a0e5460b1524055d6e505996cbeac2240edf0fdd2827bd35a8f673a34a17563b1e0d8c8cdef6d93cc61b'
export const MOCK_ORDER_ENTITY: OrderEntity = {
  encodedOrder: MOCK_ENCODED_ORDER,
  signature: MOCK_SIGNATURE,
  nonce: '0xnonce',
  orderHash: MOCK_ORDER_HASH,
  offerer: '0xofferer',
  orderStatus: ORDER_STATUS.OPEN,
  type: OrderType.Dutch,
  chainId: 1,
  reactor: REACTOR_ADDRESS_MAPPING[1][OrderType.Dutch] as string,
  decayStartTime: 1,
  decayEndTime: 2,
  deadline: 3,
  input: {
    token: '0xinput',
    startAmount: '1000000000000000000',
    endAmount: '1000000000000000000',
  },
  outputs: [
    {
      token: '0xoutput',
      startAmount: '2000000000000000000',
      endAmount: '1000000000000000000',
      recipient: '0xrecipient',
    },
  ],
}

export const dynamoConfig = {
  convertEmptyValues: true,
  endpoint: 'localhost:8000',
  region: 'local-env',
  sslEnabled: false,
  credentials: {
    accessKeyId: 'fakeMyKeyId',
    secretAccessKey: 'fakeSecretAccessKey',
  },
}
