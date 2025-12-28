export function initNavbar() {
    const page =
      document.body.dataset.page ||
      location.pathname.split("/").pop()?.replace(".html", "");
  
    document.querySelectorAll(".nav-link").forEach(link => {
      if (link.dataset.page === page) {
        link.classList.add("active");
      }
    });
  }
  