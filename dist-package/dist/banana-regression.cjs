const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('path');
const root = fs.existsSync(path.join(__dirname,'../app')) ? path.join(__dirname,'../app') : path.join(__dirname,'..');
const source = fs.readFileSync(path.join(root,'dist-package/dist/advanced-promotions.js'),'utf8');
const engine = source.slice(0,source.indexOf('\nfunction _G'));
const bridge = source.slice(source.indexOf('let checkoutPromotionSnapshot'),source.indexOf('function mve(){'));
let effect, cleanup, state, renders = 0, requestCount = 0;
let resolveFetch;
const ctx = vm.createContext({console, Set, Promise,
 fetch: () => {requestCount++; return new Promise(resolve=>{resolveFetch=resolve;});},
 setInterval: () => 1, clearInterval: () => {},
 window:{addEventListener(){},removeEventListener(){}},
 R:{useState(initial){ if(state===undefined)state=initial;return[state,v=>{state=v;renders++;}];},
 useEffect(fn){effect=fn;},useMemo(fn){return fn();}}
});
vm.runInContext(engine+'\n'+bridge,ctx);
const calc = ctx.ToastPromotionEngine.calculate;
const topping = {id:7,name:'กล้วย',type:'topping',price:10};
const rule = {id:8,name:'กล้วยลด 5',enabled:true,conditionMode:'topping',conditionToppingIds:[7],conditionMinQuantity:1,targetMode:'topping_selected',targetToppingIds:[7],applicationMode:'once',discountType:'amount',discountValue:5,maxDiscount:null,stackable:false};
const cart = [{name:'ฮันนี่โทสต์ + กล้วย',category:'custom',toppings:['กล้วย'],unitPrice:40,quantity:1}];
let passed=0;
function test(name, fn){fn();console.log('PASS '+name);passed++;}
function publish(rules){ctx.body={rules,toppings:[topping]};vm.runInContext('publishCheckoutPromotions(body)',ctx);}
function render(){ctx.legacy=[{id:8,type:'flexible',enabled:true}];return vm.runInContext('useCheckoutPromotions(legacy, [])',ctx);}
function price(){const data=render();return calc(cart,data.rules,40,data.toppings).discount;}
(async()=>{
 test('Reproduce old checkout: incomplete legacy rule produces zero discount',()=>assert.equal(calc(cart,[{id:8,type:'flexible',enabled:true}],40,[topping]).discount,0));
 render();cleanup=effect();
 test('Checkout loads editor API even before opening promotion editor',()=>assert.equal(requestCount,1));
 resolveFetch({ok:true,json:async()=>({rules:[rule],toppings:[topping]})});
 await vm.runInContext('checkoutPromotionRequest',ctx);
 test('REST rule without type discounts banana by 5; 40 -> 35',()=>assert.equal(price(),5));
 test('API response triggers React recalculation',()=>assert.ok(renders>0));
 const typed={...rule,type:'flexible'};
 test('No banana: zero discount',()=>assert.equal(calc([{...cart[0],toppings:['โอวัลติน']}],[typed],40,[topping]).discount,0));
 test('Two bananas / once: 5 total',()=>assert.equal(calc([{...cart[0],quantity:2}],[typed],80,[topping]).discount,5));
 test('Two bananas / each: 10 total',()=>assert.equal(calc([{...cart[0],quantity:2}],[{...typed,applicationMode:'each'}],80,[topping]).discount,10));
 test('Minimum 2 bananas not satisfied by 1',()=>assert.equal(calc(cart,[{...typed,conditionMinQuantity:2}],40,[topping]).discount,0));
 test('Saved-order toppingsJson supported',()=>assert.equal(calc([{...cart[0],toppings:undefined,toppingsJson:'["กล้วย"]'}],[typed],40,[topping]).discount,5));
 test('Discount capped at banana price',()=>assert.equal(calc(cart,[{...typed,discountValue:99}],40,[topping]).discount,10));
 test('Disable immediately removes discount',()=>{publish([{...rule,enabled:false}]);assert.equal(price(),0);});
 test('Edit immediately updates discount',()=>{publish([{...rule,discountValue:3}]);assert.equal(price(),3);});
 test('Delete cannot resurrect stale tRPC flexible rule',()=>{publish([]);assert.equal(price(),0);});
 test('Legacy non-flexible promotions preserved',()=>{
  ctx.legacy=[{id:99,type:'min_spend',enabled:true,minSpend:30,discountAmount:4}];
  const d=vm.runInContext('useCheckoutPromotions(legacy, [])',ctx);
  assert.equal(calc(cart,d.rules,40,d.toppings).discount,4);
 });
 const pending=vm.runInContext('loadCheckoutPromotions()',ctx);
 publish([{...rule,discountValue:2}]);
 resolveFetch({ok:true,json:async()=>({rules:[rule],toppings:[topping]})});await pending;
 test('Old polling response cannot overwrite newer saved rule',()=>assert.equal(price(),2));
 test('Checkout mutation submits computed discount',()=>assert.ok(source.includes('manualDiscount:ai,promotionDiscount:Ki')));
 test('Cost calculator entry retained',()=>assert.ok(fs.readFileSync(path.join(root,'dist-package/dist/index.html'),'utf8').includes('/cost-calculator.js?v=4')));
 cleanup();
 console.log(`${passed} tests passed`);
})().catch(e=>{console.error(e);process.exit(1)});
