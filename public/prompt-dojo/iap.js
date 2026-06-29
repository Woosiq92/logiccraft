/* 인앱결제 — CdvPurchase(StoreKit + Google Play Billing). 백엔드 0 (검증 훅 no-op).
 * 상품 1개(양 플랫폼 동일 ID, 비소모성·영구·복원):
 *   .full  전체 이용  ₩7,900  (전과목 L1 무료 → L2~L4 전체 해제)
 * 권한 저장은 index.html(entitled[]). 승인·복원 시 window.IAP.onChange(productId) 호출.
 * 동작 조건: 스토어 인앱상품 등록(아래 ID 일치) + 네이티브 빌드. 웹/미지원은 no-op. */
(function () {
  'use strict';
  var PRODUCTS = {
    full: 'kr.logiccraft.promptdojo.full'
  };
  var IDS = Object.keys(PRODUCTS).map(function (k) { return PRODUCTS[k]; });

  function platform() {
    if (!(window.Capacitor && window.Capacitor.getPlatform)) return null;
    var p = window.Capacitor.getPlatform();
    return (p === 'ios' || p === 'android') ? p : null;
  }
  function native() { return !!platform() && !!window.CdvPurchase; }
  function PLAT() {
    var P = window.CdvPurchase, p = platform();
    return p === 'ios' ? P.Platform.APPLE_APPSTORE : p === 'android' ? P.Platform.GOOGLE_PLAY : null;
  }
  function notify(id) { if (window.IAP && typeof window.IAP.onChange === 'function') window.IAP.onChange(id); }
  function verify(tx) { return Promise.resolve(true); }   // 나중에 서버 검증으로 교체 가능

  var configured = false;
  function configure() {
    if (!native() || configured) return;
    configured = true;
    var P = window.CdvPurchase, store = P.store, plat = PLAT();
    store.register(IDS.map(function (id) {
      return { id: id, type: P.ProductType.NON_CONSUMABLE, platform: plat };
    }));
    store.when()
      .approved(function (tx) {
        verify(tx).then(function (ok) {
          if (!ok) return;
          (tx.products || []).forEach(function (p) { if (IDS.indexOf(p.id) >= 0) notify(p.id); });
          tx.finish();
        });
      })
      .verified(function (receipt) { receipt.finish(); });
    store.error(function (e) { /* 취소·네트워크 — paywall에서 처리 */ });
    store.initialize([plat]);
  }

  function priceOf(key) {
    if (!native()) return null;
    var prod = window.CdvPurchase.store.get(PRODUCTS[key], PLAT());
    var off = prod && prod.offers && prod.offers[0];
    return off && off.pricingPhases && off.pricingPhases[0] ? off.pricingPhases[0].price : null;
  }
  function buy(key) {
    if (!native()) return Promise.reject(new Error('not-native'));
    var store = window.CdvPurchase.store, plat = PLAT();
    var prod = store.get(PRODUCTS[key], plat);
    var offer = prod && prod.getOffer && prod.getOffer();
    if (!offer) return Promise.reject(new Error('no-offer'));
    return store.order(offer);   // 성공은 approved 콜백에서 onChange
  }
  function restore() {
    if (!native()) return Promise.reject(new Error('not-native'));
    return window.CdvPurchase.store.restorePurchases();
  }

  window.IAP = {
    products: PRODUCTS,
    available: native,
    platform: platform,
    configure: configure,
    buy: buy,
    restore: restore,
    priceOf: priceOf,
    onChange: null,
    _setVerify: function (fn) { verify = fn; },
  };

  if (native()) {
    document.addEventListener('deviceready', configure, false);
    configure();
  }
})();
