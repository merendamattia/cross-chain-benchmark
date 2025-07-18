/**
 * @file MesonContract
 */

export interface JsonFragmentType {
  readonly name?: string
  readonly indexed?: boolean
  readonly type?: string
  // must use any to match ethers.js types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly internalType?: any
  readonly components?: readonly JsonFragmentType[]
}

export interface JsonFragment {
  readonly name?: string
  readonly type?: string

  readonly anonymous?: boolean

  readonly payable?: boolean
  readonly constant?: boolean
  readonly stateMutability?: string

  readonly inputs?: readonly JsonFragmentType[]
  readonly outputs?: readonly JsonFragmentType[]

  readonly gas?: string
}

export type ContractInterface = JsonFragment[];
