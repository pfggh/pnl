window.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("launch-overlay");

    // Simulate a brief loading/branding moment
    setTimeout(() => {
        overlay.style.opacity = "0";
        overlay.style.pointerEvents = "none";

        // Animate content entrance
        const content = document.querySelector(".content");
        if (content) {
            content.style.opacity = "0";
            content.style.transform = "translateY(20px)";
            content.style.transition = "all 0.6s cubic-bezier(0.22, 1, 0.36, 1)";

            requestAnimationFrame(() => {
                content.style.opacity = "1";
                content.style.transform = "translateY(0)";
            });
        }
    }, 800); // 0.8s hold time
});
