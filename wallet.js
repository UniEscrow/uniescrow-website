
const Wallet = (() => {
  let state = {connected:false,address:null,addressShort:null,network:null,networkName:null,networkOk:false,trxBalance:'0.00',usdtBalance:'0.00',tronWeb:null};
  let _onConnect=()=>{};
  let _onDisconnect=()=>{};
  let _onBalance=()=>{};

  function short(a){return a?a.slice(0,6)+'...'+a.slice(-4):'';}

  function detectNet(tw){
    try{
      const h=tw.fullNode&&tw.fullNode.host||'';
      if(h.includes('nile'))return{network:'nile',name:'Nile Testnet',ok:true};
      if(h.includes('shasta'))return{network:'shasta',name:'Shasta Testnet',ok:false};
      return{network:'mainnet',name:'Tron Mainnet',ok:false};
    }catch(e){return{network:'nile',name:'Nile Testnet',ok:true};}
  }

  async function readBal(tw,addr){
    try{
      const trxRaw=await tw.trx.getBalance(addr);
      const trx=(Number(trxRaw)/1e6).toFixed(2);
      return{trx,usdt:'0.00'};
    }catch(e){return{trx:'0.00',usdt:'0.00'};}
  }

  function showNoWallet(){
    const m=document.createElement('div');
    m.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;font-family:sans-serif';
    m.innerHTML='<div style="background:#050a05;border:1px solid #00ffaa;border-radius:14px;padding:32px;max-width:360px;text-align:center;color:#fff"><div style="font-size:40px;margin-bottom:16px">🔗</div><div style="font-size:18px;font-weight:800;color:#00ffaa;margin-bottom:8px">TronLink Not Found</div><div style="font-size:13px;color:#888;margin-bottom:20px">Install TronLink Chrome extension to use GlobalEscrowX.</div><a href="https://www.tronlink.org" target="_blank" style="display:block;background:#00ffaa;color:#000;padding:12px;border-radius:6px;font-size:12px;font-weight:800;text-decoration:none;margin-bottom:10px">INSTALL TRONLINK</a><div onclick="this.parentElement.parentElement.remove()" style="font-size:12px;color:#555;cursor:pointer;margin-top:8px">Dismiss</div></div>';
    document.body.appendChild(m);
  }

  function showWrongNet(name){
    removeWrongNet();
    const b=document.createElement('div');
    b.id='gex-wrong-net';
    b.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#ff4444;color:#fff;padding:10px 20px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:space-between;font-family:sans-serif';
    b.innerHTML='<span>Wrong network: '+name+' — Please switch to Nile Testnet in TronLink</span><span onclick="document.getElementById('gex-wrong-net').remove()" style="cursor:pointer;margin-left:16px">✕</span>';
    document.body.appendChild(b);
  }

  function removeWrongNet(){
    const b=document.getElementById('gex-wrong-net');
    if(b)b.remove();
  }

  async function connect(){
    if(!window.tronWeb&&!window.tronLink){
      showNoWallet();
      return null;
    }
    try{
      if(window.tronLink&&window.tronLink.request){
        await window.tronLink.request({method:'tron_requestAccounts'});
      }
      let tries=0;
      while(tries<15){
        await new Promise(function(r){setTimeout(r,500);});
        if(window.tronWeb&&window.tronWeb.defaultAddress&&window.tronWeb.defaultAddress.base58){
          break;
        }
        tries++;
      }
      const tw=window.tronWeb;
      if(!tw||!tw.defaultAddress||!tw.defaultAddress.base58){
        alert('Could not get wallet address. Please unlock TronLink and try again.');
        return null;
      }
      const address=tw.defaultAddress.base58;
      const netInfo=detectNet(tw);
      const bal=await readBal(tw,address);
      state={
        connected:true,
        address:address,
        addressShort:short(address),
        network:netInfo.network,
        networkName:netInfo.name,
        networkOk:netInfo.ok,
        trxBalance:bal.trx,
        usdtBalance:bal.usdt,
        tronWeb:tw
      };
      sessionStorage.setItem('gex_wallet',JSON.stringify({address:address}));
      _onConnect(state);
      if(!state.networkOk)showWrongNet(state.networkName);
      else removeWrongNet();
      return state;
    }catch(e){
      console.error('[Wallet connect error]',e);
      alert('Connection error: '+e.message);
      return null;
    }
  }

  function disconnect(){
    state={connected:false,address:null,addressShort:null,network:null,networkName:null,networkOk:false,trxBalance:'0.00',usdtBalance:'0.00',tronWeb:null};
    sessionStorage.removeItem('gex_wallet');
    removeWrongNet();
    _onDisconnect();
  }

  async function refreshBalances(){
    if(!state.connected||!state.tronWeb)return;
    try{
      const bal=await readBal(state.tronWeb,state.address);
      state.trxBalance=bal.trx;
      state.usdtBalance=bal.usdt;
      _onBalance(state);
    }catch(e){}
  }

  async function init(){
    try{
      const saved=sessionStorage.getItem('gex_wallet');
      if(saved&&window.tronWeb&&window.tronWeb.defaultAddress&&window.tronWeb.defaultAddress.base58){
        await connect();
      }
    }catch(e){}
    setInterval(refreshBalances,30000);
  }

  return{
    init:init,
    connect:connect,
    disconnect:disconnect,
    refreshBalances:refreshBalances,
    getState:function(){return Object.assign({},state);},
    isConnected:function(){return state.connected;},
    onConnect:function(f){_onConnect=f;},
    onDisconnect:function(f){_onDisconnect=f;},
    onBalance:function(f){_onBalance=f;}
  };
})();
