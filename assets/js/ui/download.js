// assets/js/ui/download.js
export function downloadTextFile(filename, content, mime = "text/plain") {
    const name = filename || "download.txt";
    const data = content ?? "";
    const type = mime || "text/plain";
  
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
  
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
  
    // cleanup
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }
  