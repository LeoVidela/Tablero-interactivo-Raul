// ==UserScript==
// @name         Micronauta · Entrar como invitado (Solbus)
// @namespace    https://solbus.local/
// @version      1.0.0
// @description  Acciona automáticamente "Entrar como invitado" en Micronauta (Comodoro y Córdoba) para ver la flota en tiempo real.
// @match        https://micronauta.dnsalias.net/web/urbano/*
// @match        https://micronauta4.dnsalias.net/web/urbano/*
// @match        http://micronauta.dnsalias.net/web/urbano/*
// @match        http://micronauta4.dnsalias.net/web/urbano/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  var TEXTO = /entrar\s+como\s+invitado/i;
  var CLICKABLE = 'button, a, [role="button"], input[type="button"], input[type="submit"]';

  function textoDe(el) { return ((el.innerText || el.value || el.textContent || '') + '').trim(); }

  function buscarBoton() {
    var todos = document.querySelectorAll('button, a, div, span, input, [role="button"]');
    var candidatos = [];
    for (var i = 0; i < todos.length; i++) {
      var t = textoDe(todos[i]);
      if (t && t.length < 40 && TEXTO.test(t)) candidatos.push(todos[i]);
    }
    if (!candidatos.length) return null;
    // Elemento más profundo (el que no contiene a otro candidato) y luego su ancestro clickeable.
    var hoja = candidatos.filter(function (c) { return !candidatos.some(function (o) { return o !== c && c.contains(o); }); })[0] || candidatos[0];
    return hoja.closest(CLICKABLE) || hoja;
  }

  var hecho = false;
  function intentar() {
    if (hecho) return true;
    var boton = buscarBoton();
    if (!boton) return false;
    hecho = true;
    boton.click();
    return true;
  }

  if (intentar()) return;
  // El diálogo de ingreso puede aparecer después de cargar el mapa: observamos hasta 40 s.
  var obs = new MutationObserver(function () { if (intentar()) obs.disconnect(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () { obs.disconnect(); }, 40000);
})();
