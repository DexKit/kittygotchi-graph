import { log, BigInt } from "@graphprotocol/graph-ts";
import {
  GotchiFeeded,
  KittyGotchi,
  Transfer as TransferEvent,
} from "../generated/KittyGotchi/KittyGotchi";
import { Token, Owner, Contract, Transfer } from "../generated/schema";

export function handleTransfer(event: TransferEvent): void {
  log.debug("Transfer detected. From: {} | To: {} | TokenID: {}", [
    event.params.from.toHexString(),
    event.params.to.toHexString(),
    event.params.tokenId.toHexString(),
  ]);

  let previousOwner = Owner.load(event.params.from.toHexString());
  let newOwner = Owner.load(event.params.to.toHexString());
  let token = Token.load(event.params.tokenId.toHexString());
  let transferId = event.transaction.hash
    .toHexString()
    .concat(":".concat(event.transactionLogIndex.toHexString()));
  let transfer = Transfer.load(transferId);
  let contract = Contract.load(event.address.toHexString());
  let instance = KittyGotchi.bind(event.address);

  if (previousOwner == null) {
    previousOwner = new Owner(event.params.from.toHexString());

    previousOwner.balance = BigInt.fromI32(0);
  } else {
    let prevBalance = previousOwner.balance;
    if (prevBalance && prevBalance > BigInt.fromI32(0)) {
      previousOwner.balance = prevBalance.minus(BigInt.fromI32(1));
    }
  }

  if (!newOwner) {
    newOwner = new Owner(event.params.to.toHexString());
    newOwner.balance = BigInt.fromI32(1);
  } else {
    let prevBalance = newOwner.balance;
    if (prevBalance) {
      newOwner.balance = prevBalance.plus(BigInt.fromI32(1));
    }
  }

  if (!token) {
    token = new Token(event.params.tokenId.toString());
    token.contract = event.address.toHexString();
    token.attack = BigInt.fromI32(0);
    token.defense =  BigInt.fromI32(0);
    token.run =  BigInt.fromI32(0);
    token.totalStrength =  BigInt.fromI32(0);
    let uri = instance.try_tokenURI(event.params.tokenId);
    if (!uri.reverted) {
      token.uri = uri.value;
    }
  }

  token.owner = event.params.to.toHexString();

  if (transfer == null) {
    transfer = new Transfer(transferId);
    transfer.token = event.params.tokenId.toHexString();
    transfer.from = event.params.from.toHexString();
    transfer.to = event.params.to.toHexString();
    transfer.timestamp = event.block.timestamp;
    transfer.block = event.block.number;
    transfer.transactionHash = event.transaction.hash.toHexString();
  }

  if (!contract) {
    contract = new Contract(event.address.toHexString()) as Contract;
  }
  // empty address is minting
  if (
    event.params.from.toHexString() ===
      "0x0000000000000000000000000000000000000000" &&
    contract.totalSupply
  ) {
    contract.totalSupply = contract.totalSupply.plus(BigInt.fromI32(1));
  } else {
    contract.totalSupply = BigInt.fromI32(1);
  }

  // empty address is burning
  if (
    event.params.to.toHexString() ===
    "0x0000000000000000000000000000000000000000"
  ) {
    contract.totalSupply = contract.totalSupply.minus(BigInt.fromI32(1));
  }

  let name = instance.try_name();
  if (!name.reverted) {
    contract.name = name.value;
  }

  let symbol = instance.try_symbol();
  if (!symbol.reverted) {
    contract.symbol = symbol.value;
  }

  previousOwner.save();
  newOwner.save();
  token.save();
  contract.save();
  transfer.save();
}

export function handleGotchiFeed(event: GotchiFeeded): void {
  let instance = KittyGotchi.bind(event.address);
  const token = Token.load(event.params.id.toString());
  const id = event.params.id;
  if (token) {
    let attack = instance.try_getAttackOf(id);
    if (!attack.reverted) {
      token.attack = attack.value;
    }
    let defense = instance.try_getDefenseOf(id);
    if (!attack.reverted) {
      token.defense = defense.value;
    }
    let run = instance.try_getRunOf(id);
    if (!attack.reverted) {
      token.run = run.value;
    }
    if(token.run && token.defense && token.run){
      const run = token.run as BigInt;
      const attack = token.attack as BigInt;
      const defense = token.defense as BigInt;
      token.totalStrength = run.plus(attack).plus(defense);
    }
    token.lastUpdated = event.params.at;
    token.save();
  }
 
}
