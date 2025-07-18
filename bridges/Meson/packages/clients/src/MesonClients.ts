/**
 * @file MesonClients
 */

import { IMesonRpcs, meson } from '@mesonfi/base'
import { MesonClient } from '@mesonfi/sdk'
import presets, { MesonPresets } from '@mesonfi/presets'

export type WebSocketConstructor = new (url: string) => WebSocket;

export interface MesonClientManagerOptions {
  rpcManagerURL: string
  WebSocket: WebSocketConstructor
  presets?: MesonPresets
}

export class MesonClientManager {
  private cache: Record<string, MesonClient> = {}

  private presets: MesonPresets = presets

  private rpcManagerURL: string | null = null

  private WebSocketConstructor?: WebSocketConstructor

  private rpcs: IMesonRpcs | null = null

  public getClient (networkId: string, force = false): MesonClient {
    if (this.cache[networkId] && !force) {
      return this.cache[networkId]
    }

    const client = this.createMesonClient(networkId)

    if (!force) {
      this.cache[networkId] = client
    }

    return client
  }

  public getRpcs (): IMesonRpcs {
    if (!this.rpcs) {
      throw new Error('call init method first')
    }

    return this.rpcs
  }

  public async init (options: MesonClientManagerOptions) {
    const { rpcManagerURL, WebSocket } = options

    this.WebSocketConstructor = WebSocket
    this.presets = options.presets || presets

    if (rpcManagerURL !== this.rpcManagerURL) {
      this.rpcManagerURL = rpcManagerURL
      this.rpcs = new meson.Rpcs(rpcManagerURL)

      await this.refreshAllRpcStatus()
    }
  }

  public async refreshAllRpcStatus (): Promise<void> {
    const rpcs = this.rpcs

    if (!rpcs) {
      throw new Error('call init method first')
    }

    await rpcs.refreshAllRpcStatus()

    const WebSocket = this.getWebSocketConstructor()

    Object.keys(this.cache).forEach(networkId => {
      const urls = rpcs.getHealthyRpcStatus(networkId).map(item => item.url).filter(Boolean)

      if (urls.length > 0) {
        Object.assign(this.cache[networkId], {
          wallet: this.presets.createFailoverAdaptor(networkId, urls, { WebSocket, threshold: 1 }),
        })
      }
    })
  }

  protected getWebSocketConstructor (): WebSocketConstructor {
    if (!this.WebSocketConstructor) {
      throw new Error('WebSocketConstructor is not registered')
    }

    return this.WebSocketConstructor
  }

  protected createMesonClient (networkId: string): MesonClient {
    const network = this.presets.getNetwork(networkId)

    let urls: string[] = network.url ? [network.url] : []
    if (this.rpcs) {
      const rpcStatusObject = this.rpcs.getHealthyRpcStatus(networkId)
      const rpcUrls = rpcStatusObject.map(status => status.url).filter(Boolean)

      if (rpcUrls.length > 0) {
        urls = rpcUrls
      }
    }

    if (!urls.length) {
      throw new Error('no client url was found')
    }

    const adaptor = this.presets.createFailoverAdaptor(networkId, urls, {
      WebSocket: this.getWebSocketConstructor(),
      threshold: 1,
    })

    return this.presets.createMesonClient(networkId, adaptor)
  }
}
