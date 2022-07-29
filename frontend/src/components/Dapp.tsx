import React from "react";
import {ethers} from "ethers";
import smartContract from "../contracts/Token.json";
import contractAddress from "../contracts/contract-address.json";


import {NoWalletDetected} from "./NoWalletDetected";
import {ConnectWallet} from "./ConnectWallet";
import {Loading} from "./Loading";

//todo: keep this only when building
//import {Transfer} from "./Transfer";

import {TransactionErrorMessage} from "./TransactionErrorMessage";
import {WaitingForTransactionMessage} from "./WaitingForTransactionMessage";
import {NoTokensMessage} from "./NoTokensMessage";
import {FreeMint} from "./free-mint";

const HARDHAT_NETWORK_ID = '1337';
const GOERLI_NETWORK_ID = '5';
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

// Defining the Dapp components state and props for type safety.
interface TokenData {
    name: string;
    symbol: string;
}

// Initial State
interface IState {
    tokenData?: TokenData;
    selectedAddress?: string;
    balance?: ethers.BigNumber;
    txBeingSent?: string;
    transactionError?: Error;
    networkError?: string;
}

// Since window.ethereum is not recognized by the TypeScript compiler, 
// we use this little hack
declare let window: any;

// This component is in charge of doing these things:
//   1. It connects to the user's wallet
//   2. Initializes ethers and the Token contract
//   3. Polls the user balance to keep it updated.
//   4. Transfers tokens by sending transactions
//   5. Renders the whole application
//
// Note that (3) and (4) are specific of this sample application, but they show
// you how to keep your Dapp and contract's state in sync,  and how to send a
// transaction.
export class Dapp extends React.Component<{}, IState> {
    initialState = {
        tokenData: undefined,
        selectedAddress: undefined,
        balance: undefined,
        txBeingSent: undefined,
        transactionError: undefined,
        networkError: undefined,
    };
    private _provider: ethers.providers.Web3Provider;
    private _pollDataInterval: NodeJS.Timer;
    private _pionerPass: any;

    constructor(props) {
        super(props);
        this.state = this.initialState;
    }

    render() {
        if (window.ethereum === undefined) {
            return <NoWalletDetected/>;
        }


        if (!this.state.selectedAddress) {
            return (
                <ConnectWallet
                    connectWallet={() => this._connectWallet()}
                    networkError={this.state.networkError}
                    dismiss={() => this._dismissNetworkError()}
                />
            );
        }
        if (!this.state.tokenData || !this.state.balance) {
            return <Loading/>;
        }

        // If everything is loaded, we render the application.
        return (
            <div className="container p-4">
                <div className="row">
                    <div className="col-12">
                        <h1>
                            {this.state.tokenData.name} ({this.state.tokenData.symbol})
                        </h1>
                        <p>
                            Welcome <b>{this.state.selectedAddress}</b>, you have{" "}
                            <b>
                                {this.state.balance.toString()} {this.state.tokenData.symbol}
                            </b>
                            .
                        </p>
                    </div>
                </div>

                <hr/>

                <div className="row">
                    <div className="col-12">
                        {/*
              Sending a transaction isn't an immediate action. You have to wait
              for it to be mined.
              If we are waiting for one, we show a message here.
            */}
                        {this.state.txBeingSent && (
                            <WaitingForTransactionMessage txHash={this.state.txBeingSent}/>
                        )}

                        {/*
              Sending a transaction can fail in multiple ways. 
              If that happened, we show a message here.
            */}
                        {this.state.transactionError && (
                            <TransactionErrorMessage
                                message={this._getRpcErrorMessage(this.state.transactionError)}
                                dismiss={() => this._dismissTransactionError()}
                            />
                        )}
                    </div>
                </div>

                <div className="row">
                    <div className="col-12">
                        {/*
              If the user has no tokens, we don't show the Transfer form
            */}
                        {this.state.balance.eq(0) && (
                            <NoTokensMessage selectedAddress={this.state.selectedAddress}/>
                        )}

                        {/*
              This component displays a form that the user can use to send a 
              transaction and transfer some tokens.
              The component doesn't have logic, it just calls the transferTokens
              callback.
            */}
                        {this.state.balance.gt(0) && (
                            <FreeMint
                                freeMint={() =>
                                    this._freeMint()
                                }
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    componentWillUnmount() {
        this._stopPollingData();
    }


    /*
    * Stuff
    * */

    async _connectWallet() {
        const [selectedAddress] = await window.ethereum.request({method: 'eth_requestAccounts'});
        if (!this._checkNetwork()) {
            return;
        }

        this._initialize(selectedAddress);

        // We reinitialize it whenever the user changes their account.
        window.ethereum.on("accountsChanged", ([newAddress]) => {
            this._stopPollingData();
            // `accountsChanged` event can be triggered with an undefined newAddress.
            // This happens when the user removes the Dapp from the "Connected
            // list of sites allowed access to your addresses" (Metamask > Settings > Connections)
            // To avoid errors, we reset the dapp state
            if (newAddress === undefined) {
                return this._resetState();
            }
            this._initialize(newAddress);
        });

        // We reset the dapp state if the network is changed
        window.ethereum.on("chainChanged", ([networkId]) => {
            console.log("Your new network ID: " + networkId)
            this._stopPollingData();
            this._resetState();
        });
    }

    _initialize(userAddress) {
        this.setState({selectedAddress: userAddress,});
        this._initializeEthers().then(r => console.log(r));
        this._getTokenData().then(r => console.log(r));
        this._startPollingData();
    }

    async _initializeEthers() {
        this._provider = new ethers.providers.Web3Provider(window.ethereum);
        this._pionerPass = new ethers.Contract(
            contractAddress.PioneerPassAddress,
            smartContract.abi,
            this._provider.getSigner(0)
        );
    }

    _startPollingData() {
        this._pollDataInterval = setInterval(() => this, 1000);
        this._updateBalance().then(r => console.log(r));
    }

    _stopPollingData() {
        clearInterval(this._pollDataInterval);
        this._pollDataInterval = undefined;
    }

    async _getTokenData() {
        const name = await this._pionerPass.name();
        const symbol = await this._pionerPass.symbol();
        this.setState({tokenData: {name, symbol}});
    }

    async _updateBalance() {
        //todo: get the token id
        const balance = await this._pionerPass.balanceOf(this.state.selectedAddress,1);
        this.setState({balance});
    }

    // This method sends an ethereum transaction to mint free tokens.
    async _freeMint() {
        try {
            this._dismissTransactionError();

            //todo: add our contract and our free mint function
            const tx = await this._pionerPass.freeMint(1,1);
            this.setState({txBeingSent: tx.hash});
            const receipt = await tx.wait();

            // The receipt, contains a status flag, which is 0 to indicate an error.
            if (receipt.status === 0) {
                // We can't know the exact error that made the transaction fail when it
                // was mined, so we throw this generic one.
                throw new Error("Transaction failed");
            }

            //todo check the balance of the token
            await this._updateBalance();
        } catch (error) {
            //todo: add more error codes as needed
            // We check the error code to see if this error was produced because the
            // user rejected a tx. If that's the case, we do nothing.
            if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
                return;
            }
            console.error(error);
            this.setState({transactionError: error});
        } finally {
            // If we leave the try/catch, we aren't sending a tx anymore, so we clear
            // this part of the state.
            this.setState({txBeingSent: undefined});
        }
    }

//todo: only keep this while building
    // async _transferTokens(to, amount) {
    //     // Sending a transaction is a complex operation:
    //     //   - The user can reject it
    //     //   - It can fail before reaching the ethereum network (i.e. if the user
    //     //     doesn't have ETH for paying for the tx's gas)
    //     //   - It has to be mined, so it isn't immediately confirmed.
    //     //     Note that some testing networks, like Hardhat Network, do mine
    //     //     transactions immediately, but your dapp should be prepared for
    //     //     other networks.
    //     //   - It can fail once mined.
    //     //
    //     // This method handles all of those things, so keep reading to learn how to
    //     // do it.
    //
    //     try {
    //         // If a transaction fails, we save that error in the component's state.
    //         // We only save one such error, so before sending a second transaction, we
    //         // clear it.
    //         this._dismissTransactionError();
    //
    //         // We send the transaction, and save its hash in the Dapp's state. This
    //         // way we can indicate that we are waiting for it to be mined.
    //         const tx = await this._pionerPass.transfer(to, amount);
    //         this.setState({txBeingSent: tx.hash});
    //
    //         // We use .wait() to wait for the transaction to be mined. This method
    //         // returns the transaction's receipt.
    //         const receipt = await tx.wait();
    //
    //         // The receipt, contains a status flag, which is 0 to indicate an error.
    //         if (receipt.status === 0) {
    //             // We can't know the exact error that made the transaction fail when it
    //             // was mined, so we throw this generic one.
    //             throw new Error("Transaction failed");
    //         }
    //
    //         // If we got here, the transaction was successful, so you may want to
    //         // update your state. Here, we update the user's balance.
    //         await this._updateBalance();
    //     } catch (error) {
    //         // We check the error code to see if this error was produced because the
    //         // user rejected a tx. If that's the case, we do nothing.
    //         if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
    //             return;
    //         }
    //
    //         // Other errors are logged and stored in the Dapp's state. This is used to
    //         // show them to the user, and for debugging.
    //         console.error(error);
    //         this.setState({transactionError: error});
    //     } finally {
    //         // If we leave the try/catch, we aren't sending a tx anymore, so we clear
    //         // this part of the state.
    //         this.setState({txBeingSent: undefined});
    //     }
    // }

    // This method just clears part of the state.
    _dismissTransactionError() {
        this.setState({transactionError: undefined});
    }

    // This method just clears part of the state.
    _dismissNetworkError() {
        this.setState({networkError: undefined});
    }

    // This is a utility method that turns an RPC error into a human-readable
    // message.
    _getRpcErrorMessage(error) {
        if (error.data) {
            return error.data.message;
        }

        return error.message;
    }

    // This method resets the state
    _resetState() {
        this.setState(this.initialState);
    }

    //todo: add ethereum mainnet
    // This method checks if Metamask selected network is Localhost:8545 or Goërli
    _checkNetwork() {
        if (window.ethereum.networkVersion === HARDHAT_NETWORK_ID) {
            console.log("Youre connected to a local host hardhat network instance")
            return true;
        } else if (window.ethereum.networkVersion === GOERLI_NETWORK_ID) {
            console.log("Youre connected to the Goërli Tesnet")
            return true;
        }

        this.setState({
            networkError: 'Please connect Metamask to Localhost:8545 or the Goërli testnet'
        });
        return false;
    }
}
