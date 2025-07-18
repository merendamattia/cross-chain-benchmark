/**
 * @file MesonSalt
 */

export interface IMesonSaltHeader {

  // salt & 0x80000000000000000000 == true => will release to an EOA address, otherwise a smart contract;
  notToContract: boolean

  // salt & 0x40000000000000000000 == true => will waive *service fee*;
  waiveServiceFee: boolean

  // salt & 0x20000000000000000000 == true => meson.to;
  isMesonTo: boolean

  // salt & 0x10000000000000000000 == true => API;
  isApi: boolean

  // salt & 0x08000000000000000000 == true => use *non-typed signing
  // some wallets such as hardware wallets don't support EIP-712v1;
  useNonTypedSigning: boolean

  // salt & 0x04000000000000000000 == true => swap for core token (n/a for releasing to contract);
  amountForCoreToken: boolean

  // salt & 0x02000000000000000000 == true => share some release amount to partner;
  amountToShare: boolean

  // salt & 0x01000000000000000000 == true => use points to waive service fee;
  // in reality, the salt header would be 0x4100
  usePointsToWaiveServiceFee: boolean

  // salt & 0x00800000000000000000 == true => swap from other platform with reward.
  withReward: boolean

  // salt & 0x0010000000000000000 == true => the target chain use new format.
  // This is a temporary solution for the current version. Solana and Skale use the old format.
  newFormatCoreToken: boolean

  // salt & 0x000f0000000000000000  => the track id from referrer.
  trackId: number
}
