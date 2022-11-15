import { BigNumber } from 'ethers'
import { DutchLimitOrder, DutchOutput } from 'gouda-sdk'
import FieldValidator from './field-validator'

export type OrderValidationResponse = {
  valid: boolean
  errorString?: string
}

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365

export class OrderValidator {
  constructor(private readonly getCurrentTime: () => number, private readonly minOffset = 60) {}

  validate(order: DutchLimitOrder): OrderValidationResponse {
    const deadlineValidation = this.validateDeadline(order.info.deadline)
    if (!deadlineValidation.valid) {
      return deadlineValidation
    }

    const startTimeValidation = this.validateStartTime(order.info.startTime, order.info.deadline)
    if (!startTimeValidation.valid) {
      return startTimeValidation
    }

    const nonceValidation = this.validateNonce(order.info.nonce)
    if (!nonceValidation.valid) {
      return nonceValidation
    }

    const offererValidation = this.validateOfferer(order.info.offerer)
    if (!offererValidation.valid) {
      return offererValidation
    }

    const reactorValidation = this.validateReactor(order.info.reactor)
    if (!reactorValidation.valid) {
      return reactorValidation
    }

    const inputTokenValidation = this.validateInputToken(order.info.input.token)
    if (!inputTokenValidation.valid) {
      return inputTokenValidation
    }

    const inputAmountValidation = this.validateInputAmount(order.info.input.amount)
    if (!inputAmountValidation.valid) {
      return inputAmountValidation
    }

    const outputsValidation = this.validateOutputs(order.info.outputs)
    if (!outputsValidation.valid) {
      return outputsValidation
    }

    const orderHashValidation = this.validateHash(order.hash())
    if (!orderHashValidation.valid) {
      return orderHashValidation
    }
    return {
      valid: true,
    }
  }

  private validateDeadline(deadline: number): OrderValidationResponse {
    if (deadline < this.getCurrentTime() + this.minOffset) {
      return {
        valid: false,
        errorString: `Insufficient Deadline`,
      }
    }
    /* 
      We use AWS step function for status tracking
      Step function last at most one year, so deadline can
      be at most one year from now
    */
    if (deadline > this.getCurrentTime() + ONE_YEAR_IN_SECONDS) {
      return {
        valid: false,
        errorString: `Deadline field invalid: Order expiry cannot be larger than one year`,
      }
    }
    return {
      valid: true,
    }
  }

  private validateStartTime(startTime: number, deadline: number): OrderValidationResponse {
    if (startTime > deadline) {
      return {
        valid: false,
        errorString: 'Invalid startTime: startTime > deadline',
      }
    }
    return {
      valid: true,
    }
  }

  private validateNonce(nonce: BigNumber): OrderValidationResponse {
    const error = FieldValidator.isValidNonce().validate(nonce.toString()).error
    if (error) {
      return {
        valid: false,
        errorString: `Invalid nonce: ${error}`,
      }
    }
    return {
      valid: true,
    }
  }

  private validateOfferer(offerer: string): OrderValidationResponse {
    const error = FieldValidator.isValidEthAddress().validate(offerer).error
    if (error) {
      return {
        valid: false,
        errorString: `Invalid offerer: ${error}`,
      }
    }
    return {
      valid: true,
    }
  }

  // TODO: Once deployed contracts are finalized, we can restrict this
  // to check against a known set of addresses.
  private validateReactor(reactor: string): OrderValidationResponse {
    const error = FieldValidator.isValidEthAddress().validate(reactor).error
    if (error) {
      return {
        valid: false,
        errorString: `Invalid reactor: ${error}`,
      }
    }
    return {
      valid: true,
    }
  }

  private validateInputToken(token: string): OrderValidationResponse {
    const error = FieldValidator.isValidEthAddress().validate(token).error
    if (error) {
      return {
        valid: false,
        errorString: `Invalid input token: ${error}`,
      }
    }
    return {
      valid: true,
    }
  }

  private validateInputAmount(amount: BigNumber): OrderValidationResponse {
    if (!this.isValidUint256(amount)) {
      return {
        valid: false,
        errorString: `Invalid input amount: ${amount.toString()}`,
      }
    }
    return {
      valid: true,
    }
  }

  private validateOutputs(dutchOutputs: DutchOutput[]): OrderValidationResponse {
    for (const output of dutchOutputs) {
      const { token, recipient, startAmount, endAmount } = output
      if (FieldValidator.isValidEthAddress().validate(token).error) {
        return {
          valid: false,
          errorString: `Invalid output token ${token}`,
        }
      }

      if (FieldValidator.isValidEthAddress().validate(recipient).error) {
        return {
          valid: false,
          errorString: `Invalid recipient ${recipient}`,
        }
      }

      if (!this.isValidUint256(startAmount)) {
        return {
          valid: false,
          errorString: `Invalid startAmount ${startAmount.toString()}`,
        }
      }

      if (!this.isValidUint256(endAmount)) {
        return {
          valid: false,
          errorString: `Invalid endAmount ${endAmount.toString()}`,
        }
      }

      if (endAmount.gt(startAmount)) {
        return {
          valid: false,
          errorString: `Invalid endAmount > startAmount`,
        }
      }
    }
    return {
      valid: true,
    }
  }

  private validateHash(orderHash: string): OrderValidationResponse {
    const error = FieldValidator.isValidOrderHash().validate(orderHash).error
    if (error) {
      return {
        valid: false,
        errorString: `Invalid orderHash: ${error}`,
      }
    }
    return {
      valid: true,
    }
  }

  private isValidUint256(value: BigNumber) {
    return value.gte(0) && value.lt(BigNumber.from(1).shl(256))
  }
}