ToastPOS Promotion Fix v4

Upload these paths to the same paths in your GitHub repository:
  worker.js
  dist-package/dist/index.html
  dist-package/dist/advanced-promotions.js
  dist-package/dist/promotion-engine.js
  dist-package/dist/assets/index-PromotionFixV4.js

The new asset filename is intentional. Keep any other existing assets and CSS.
After Cloudflare deploys, open the website and verify its index.html requests:
  /assets/index-PromotionFixV4.js?v=4
  /promotion-engine.js?v=4
  /advanced-promotions.js?v=4

Test cart: Honey toast + Ovaltine + condensed milk + banana + whipping cream + sugar.
The product subtotal is 60 baht. The banana promotion should deduct 5 baht,
leaving 55 baht, without adding a drink.
