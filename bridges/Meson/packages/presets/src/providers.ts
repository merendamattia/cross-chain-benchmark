import { RPC as CkbRPC } from '@ckb-lumos/lumos'
import { TonClient, type TonClientParameters } from '@ton/ton'
import { Aptos as AptosClient, Network, AptosConfig } from '@aptos-labs/ts-sdk'

export class ExtendedAptosClient extends AptosClient {
  constructor(url: string) {
    super(new AptosConfig({ fullnode: url, indexer: `${url}/graphql`, network: Network.CUSTOM }))
  }
}

export class ExtendedCkbClient extends CkbRPC {
  readonly metadata: any

  constructor(url: string, config: any, metadata: any) {
    super(url, config || {})
    this.metadata = metadata
  }
}

export class ExtendedTonClient extends TonClient {
  readonly metadata: any

  constructor(parameters: TonClientParameters, metadata: any) {
    super(parameters)
    this.metadata = metadata
  }
}
