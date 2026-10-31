/*
 * Script clásico (no módulo): detecta si la página se abrió con doble clic
 * (protocolo file://), donde los navegadores bloquean los módulos ES,
 * y muestra cómo iniciar el servidor local.
 */
(function () {
  if (window.location.protocol !== 'file:') return;
  document.addEventListener('DOMContentLoaded', function () {
    var box = document.createElement('div');
    box.className = 'boot-warning';
    var title = document.createElement('h1');
    title.textContent = 'Inicia la tienda con un servidor local';
    var text = document.createElement('p');
    text.textContent =
      'Esta aplicación usa módulos de JavaScript, que el navegador bloquea al abrir archivos directamente. ' +
      'Desde la carpeta del proyecto ejecuta uno de estos comandos y abre http://localhost:5173:';
    var list = document.createElement('ul');
    ['node server.mjs', 'python -m http.server 5173'].forEach(function (cmd) {
      var li = document.createElement('li');
      var code = document.createElement('code');
      code.textContent = cmd;
      li.appendChild(code);
      list.appendChild(li);
    });
    box.append(title, text, list);
    document.body.replaceChildren(box);
  });
})();
