import {ethers} from 'hardhat';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';

import {BigNumber, BigNumberish, Signer} from "ethers";
import {CarbonX, CarbonX__factory} from "../typechain";

chai.use(chaiAsPromised);
const {expect} = chai;


describe('CarbonX BasicTests', () => {
    let token: CarbonX,
        axel: SignerWithAddress,
        ben: SignerWithAddress,
        chantal: SignerWithAddress,
        governance: SignerWithAddress,
        backend: SignerWithAddress
    ;

    const createSignature = async (
        to: string,
        tokenId: BigNumberish,
        amount: BigNumberish,
        hash: string,
        signerAccount: Signer = backend,
    ) => {
        let message = '';
        
        if(hash == '') {
            message = await token["createMessage(address,uint256,uint256)"](to, tokenId, amount)
        } else {
            message = await token["createMessage(address,uint256,uint256,string)"](to, tokenId, amount, hash)
        }
        return await signerAccount.signMessage(ethers.utils.arrayify(message));
    };

    beforeEach(async () => {
        [axel, ben, chantal, governance, backend] = await ethers.getSigners();

        const tokenFactory = (await ethers.getContractFactory('CarbonX', governance)) as CarbonX__factory;

        token = await tokenFactory.deploy(backend.address, 'ipfs://');
        await token.deployed();

        expect(token.address).to.properAddress;
    });

    // 4
    describe('we can mint tokens', async () => {
        const 
            tokenId = 1001,
            amount = 1,
            hash = 'NgcFOAfYXwVrmQrUOyB0U5kWU4w1a8Gf2gPPTPBrGTqTl-6qe7ERStbEMamFV4niv1bhFKI5167vzMLApLOEBs0ArvvUiClrRAFb=w600';

        let sigForAxel: string,
            axelAsMinter: CarbonX,
            chantalAsMinter: CarbonX;

        beforeEach(async () => {
            sigForAxel = await createSignature(axel.address, tokenId, amount, hash, backend);
            axelAsMinter = token.connect(axel);
            chantalAsMinter = token.connect(chantal);
        })

        it('should create tokens to Axel successfully', async () => {
            const totalSupplyBefore = await token.totalSupply(tokenId);

            const balanceBefore = await token.balanceOf(axel.address, tokenId);
            expect(balanceBefore).to.eq(0);

            await axelAsMinter.create(axel.address, tokenId, amount, hash, sigForAxel);

            const balance = await token.balanceOf(axel.address, tokenId);
            expect(balance).to.eq(1);

            const totalSupply = await token.totalSupply(tokenId);
            expect(totalSupply).to.eq(totalSupplyBefore.add(amount));

            const uri = await token.uri(tokenId);
            expect(uri).to.eq(hash);
        });

        it('can mint more tokens to Others successfully', async () => {
            const totalSupplyBefore = await token.totalSupply(tokenId);

            const balanceBefore = await token.balanceOf(ben.address, tokenId);
            expect(balanceBefore).to.eq(0);

            await axelAsMinter.create(axel.address, tokenId, amount, hash, sigForAxel);

            const sigForBen = await createSignature(ben.address, tokenId, 5, '', backend);
            await axelAsMinter.mintTo(ben.address, tokenId, 5, sigForBen);

            const balanceAxel = await token.balanceOf(axel.address, tokenId);
            expect(balanceAxel).to.eq(amount);
            
            const balanceBen = await token.balanceOf(ben.address, tokenId);
            expect(balanceBen).to.eq(5);

            const totalSupply = await token.totalSupply(tokenId);
            expect(totalSupply).to.eq(totalSupplyBefore.add(amount + 5));
        });

        it('minting of un-created token will be reverted', async () => {
            const sigForBen = await createSignature(ben.address, tokenId, 5, '', backend);
            await expect(axelAsMinter.mintTo(ben.address, tokenId, 5, sigForBen)).to.be.revertedWith('reverted');
        });
        
        it('will revert if non-owners will change signer account', async() => {
            const benAsSigner = token.connect(ben)
            await expect(benAsSigner.setSigner(axel.address)).to.be.revertedWith('Ownable: caller is not the owner')
        })

        it('governance can change signer account', async() => {
            await expect(token.setSigner(axel.address))
                .to.emit(token, 'SignerChanged')
                .withArgs(backend.address, axel.address);
        })

        it('Withdrawal as non-owner will be reverted', async () => {
            await expect(axelAsMinter.withdraw()).to.be.revertedWith('Ownable: caller is not the owner')
        })
        
    });

});

export function ether(e: BigNumberish): BigNumber {
    return ethers.utils.parseUnits(e.toString(), 'ether');
}

export function formatBytesString(text: string): string {
    const bytes = ethers.utils.toUtf8Bytes(text);

    return ethers.utils.hexlify(bytes);
}
