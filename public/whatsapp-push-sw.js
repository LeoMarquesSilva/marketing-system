/*
 * Nome antigo do service worker dos avisos de lead do WhatsApp. Agora o site tem
 * um service worker só, public/sw.js (app instalável + push). Este arquivo fica
 * para os navegadores que já tinham registrado este nome: a inscrição do push é
 * da registração e continua valendo, e na próxima visita a página troca para /sw.js.
 */
importScripts("/sw.js");
