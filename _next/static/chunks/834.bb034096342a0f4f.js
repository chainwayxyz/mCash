"use strict";
(self["webpackChunk_N_E"] = self["webpackChunk_N_E"] || []).push([[834],{

/***/ 8834:
/***/ (function(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createLocalBlockchain": function() { return /* binding */ createLocalBlockchain; },
/* harmony export */   "deploy": function() { return /* binding */ deploy; },
/* harmony export */   "deposit": function() { return /* binding */ deposit; },
/* harmony export */   "doProofs": function() { return /* binding */ doProofs; },
/* harmony export */   "getZkAppState": function() { return /* binding */ getZkAppState; },
/* harmony export */   "mCashZkApp": function() { return /* binding */ mCashZkApp; },
/* harmony export */   "withdraw": function() { return /* binding */ withdraw; }
/* harmony export */ });
/* harmony import */ var snarkyjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6400);
var __decorate = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (undefined && undefined.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};

class CustomMerkleWitness extends (0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .MerkleWitness */ .Pj)(256) {
}
// import {
//   // OffChainStorage,
//   // Update,
//   MerkleWitness256,
// } from 'experimental-zkapp-offchain-storage';

// await isReady;
const doProofs = false;
class mCashZkApp extends snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .SmartContract */ .C3 {
    constructor() {
        super(...arguments);
        this.events = {
            deposit: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN,
            withdraw: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN,
        };
        this.nullifierRoot = (0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .State */ .ZM)();
        this.commitmentRoot = (0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .State */ .ZM)();
        this.lastCommitment = (0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .State */ .ZM)();
        this.amount = new snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .UInt64 */ .zM(snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .UInt64.from */ .zM.from(8e9));
        this.fee = (0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .State */ .ZM)();
    }
    deploy(args) {
        super.deploy(args);
        this.setPermissions({
            ...snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Permissions["default"] */ .Pl["default"](),
            // setting 'Permission' to 'none' in order to avoid Problems with signing transactions in the browser
            editState: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Permissions.proofOrSignature */ .Pl.proofOrSignature(),
            send: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Permissions.proofOrSignature */ .Pl.proofOrSignature(),
            editSequenceState: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Permissions.proofOrSignature */ .Pl.proofOrSignature(),
            incrementNonce: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Permissions.proofOrSignature */ .Pl.proofOrSignature(),
            setDelegate: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Permissions.proofOrSignature */ .Pl.proofOrSignature(),
            setPermissions: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Permissions.proofOrSignature */ .Pl.proofOrSignature(),
            setTokenSymbol: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Permissions.proofOrSignature */ .Pl.proofOrSignature(),
            setVerificationKey: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Permissions.proofOrSignature */ .Pl.proofOrSignature(),
            setVotingFor: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Permissions.proofOrSignature */ .Pl.proofOrSignature(),
            setZkappUri: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Permissions.proofOrSignature */ .Pl.proofOrSignature(),
        });
    }
    init(zkAppPrivateKey) {
        super.init(zkAppPrivateKey);
        const emptyTreeRoot = new snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .MerkleTree */ .MV(256).getRoot();
        this.nullifierRoot.set(emptyTreeRoot);
        this.commitmentRoot.set(emptyTreeRoot);
        this.lastCommitment.set((0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN)(1));
    }
    deposit(nullifier, secret, commitmentWitness, caller) {
        let payerAccountUpdate = snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .AccountUpdate.createSigned */ .nx.createSigned(caller);
        payerAccountUpdate.send({ to: this.address, amount: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .UInt64.from */ .zM.from(1e9) });
        // commitment = hash(nullifier, secret)
        const commitment = snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Poseidon.hash */ .jm.hash([nullifier, secret]);
        // verify that the commitment is in right index
        const commitmentIndex = commitmentWitness.calculateIndex();
        const lastCommitmentInContract = this.lastCommitment.get();
        this.lastCommitment.assertEquals(lastCommitmentInContract);
        lastCommitmentInContract.assertEquals(commitmentIndex);
        // verify that the commitment is a valid commitment
        const commitmentRootInContract = this.commitmentRoot.get();
        this.commitmentRoot.assertEquals(commitmentRootInContract);
        commitmentRootInContract.assertEquals(commitmentWitness.calculateRoot((0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN)(0)));
        const commitmentRootFromPath = commitmentWitness.calculateRoot(commitment);
        this.commitmentRoot.set(commitmentRootFromPath);
        this.lastCommitment.set(commitmentIndex.add(1));
        this.emitEvent('deposit', commitment);
    }
    withdraw(nullifier, secret, commitmentWitness, nullifierWitness, caller) {
        // commitment = hash(nullifier, secret)
        const commitment = snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Poseidon.hash */ .jm.hash([nullifier, secret]);
        const commitmentRootInContract = this.commitmentRoot.get();
        this.commitmentRoot.assertEquals(commitmentRootInContract);
        commitmentRootInContract.assertEquals(commitmentWitness.calculateRoot(commitment));
        // verify that the nullifier is a valid nullifier
        // traverse nullifierPath
        const nullifierRootFromPath = nullifierWitness.calculateRoot((0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN)(0));
        const nullifierFromPath = nullifierWitness.calculateIndex();
        // verify nullifierPath
        const nullifierRootInContract = this.nullifierRoot.get();
        this.nullifierRoot.assertEquals(nullifierRootInContract);
        nullifierRootInContract.assertEquals(nullifierRootFromPath);
        nullifier.assertEquals(nullifierFromPath);
        this.nullifierRoot.set(nullifierWitness.calculateRoot((0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN)(1)));
        // Send mina
        this.send({
            to: caller.toPublicKey(),
            amount: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .UInt64.from */ .zM.from(1e9),
        });
        this.emitEvent('withdraw', nullifier);
    }
}
__decorate([
    (0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .state */ .SB)(snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN),
    __metadata("design:type", Object)
], mCashZkApp.prototype, "nullifierRoot", void 0);
__decorate([
    (0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .state */ .SB)(snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN),
    __metadata("design:type", Object)
], mCashZkApp.prototype, "commitmentRoot", void 0);
__decorate([
    (0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .state */ .SB)(snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN),
    __metadata("design:type", Object)
], mCashZkApp.prototype, "lastCommitment", void 0);
__decorate([
    (0,snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .state */ .SB)(snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN),
    __metadata("design:type", Object)
], mCashZkApp.prototype, "fee", void 0);
__decorate([
    snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .method */ .UD,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .PrivateKey */ ._q]),
    __metadata("design:returntype", void 0)
], mCashZkApp.prototype, "init", null);
__decorate([
    snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .method */ .UD,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN,
        snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN,
        CustomMerkleWitness,
        snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .PrivateKey */ ._q]),
    __metadata("design:returntype", void 0)
], mCashZkApp.prototype, "deposit", null);
__decorate([
    snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .method */ .UD,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN,
        snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Field */ .gN,
        CustomMerkleWitness,
        CustomMerkleWitness,
        snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .PrivateKey */ ._q]),
    __metadata("design:returntype", void 0)
], mCashZkApp.prototype, "withdraw", null);
// helpers
function createLocalBlockchain() {
    let Local = snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Mina.LocalBlockchain */ .No.LocalBlockchain({
        proofsEnabled: doProofs,
    });
    snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Mina.setActiveInstance */ .No.setActiveInstance(Local);
    const deployerAccount = Local.testAccounts[0].privateKey;
    const payerAccount = Local.testAccounts[1].privateKey;
    return [deployerAccount, payerAccount];
}
async function deploy(zkAppInstance, zkAppPrivateKey, account) {
    let tx = await snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Mina.transaction */ .No.transaction(account, () => {
        snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .AccountUpdate.fundNewAccount */ .nx.fundNewAccount(account);
        // zkAppInstance.init();
        zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });
    });
    await tx.prove();
    await tx.send();
    tx = await snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Mina.transaction */ .No.transaction(account, () => {
        let payerAccountUpdate = snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .AccountUpdate.createSigned */ .nx.createSigned(account);
        const zkAppAddress = zkAppInstance.address;
        payerAccountUpdate.send({ to: zkAppAddress, amount: snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .UInt64.from */ .zM.from(8e9) });
    });
    await tx.prove();
    await tx.send();
}
async function deposit(nullifier, secret, commitmentWitness, deployerAccount, zkAppAddress
// _zkAppPrivateKey: PrivateKey
) {
    let tx = await snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Mina.transaction */ .No.transaction(deployerAccount, () => {
        let contract = new mCashZkApp(zkAppAddress);
        contract.deposit(nullifier, secret, commitmentWitness, deployerAccount);
        // if (!doProofs) contract.sign(zkAppPrivateKey);
    });
    try {
        await tx.prove();
        await tx.send();
        return true;
    }
    catch (err) {
        console.log('Transaction failed with error', err);
        return false;
    }
}
async function withdraw(nullifier, secret, commitmentWitness, nullifierWitness, account, zkAppAddress
// _zkAppPrivateKey: PrivateKey
) {
    let tx = await snarkyjs__WEBPACK_IMPORTED_MODULE_0__/* .Mina.transaction */ .No.transaction(account, () => {
        let zkApp = new mCashZkApp(zkAppAddress);
        zkApp.withdraw(nullifier, secret, commitmentWitness, nullifierWitness, account);
        // if (!doProofs) zkApp.sign(zkAppPrivateKey);
    });
    try {
        await tx.prove();
        await tx.send();
        return true;
    }
    catch (err) {
        return false;
    }
}
function getZkAppState(contract) {
    let nullifierRoot = contract.nullifierRoot.get();
    let commitmentRoot = contract.commitmentRoot.get();
    let lastCommitment = contract.lastCommitment.get();
    return {
        nullifierRoot,
        commitmentRoot,
        lastCommitment,
    };
}
//# sourceMappingURL=mCash.js.map

/***/ })

}]);