const botaoMenu = document.querySelector("#btnMenu");
const menu = document.querySelector("#menuLateral");
const botaoFechar = document.querySelector("#btnFecharMenu");

botaoMenu.addEventListener("click", () => {
    if (menu.open) return;
    menu.showModal();
    botaoMenu.setAttribute("aria-expanded", "true");
});

botaoFechar.addEventListener("click", () => menu.close());

menu.addEventListener("click", (evento) => {
    const limites = menu.getBoundingClientRect();
    if (evento.target === menu && (
        evento.clientX < limites.left || evento.clientX > limites.right ||
        evento.clientY < limites.top || evento.clientY > limites.bottom
    )) {
        menu.close();
    }
});

menu.addEventListener("close", () => {
    botaoMenu.setAttribute("aria-expanded", "false");
    botaoMenu.focus();
});
