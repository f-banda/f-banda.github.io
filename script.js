document.addEventListener("DOMContentLoaded", function () {
    const titles = ["|", "_", "|", "_", "|", "F", "Fr", "Fra", "Fran", "Franc", "Franci", "Francis", "Francisc", "Francisco", "Francisco", "Francisco", "Francisco", "Francisc", "Francis", "Franci", "Franc", "Fran", "Fra", "Fr", "F", "|", "_", "|", "_", "|", "B", "Ba", "Ban", "Band", "Banda", "Banda", "Banda", "Banda", "Band", "Ban", "Ba", "B"];

    let currentIndex = 0;

    function updateTitle() {
        document.title = titles[currentIndex];
        currentIndex = (currentIndex + 1) % titles.length;
    }

    updateTitle();

    setInterval(updateTitle, 250);

    const nameElement = document.getElementById('name');
    if (nameElement) { // Check if the element exists
        let name = 'Francisco Banda';
        nameElement.innerHTML = ''; // Clear the content
        let i = 0;
        function typeWriter() {
            if (i < name.length) {
                nameElement.innerHTML += name.charAt(i);
                i++;
                setTimeout(typeWriter, 100);
            }
        }
        typeWriter();
    }

    const cursor = document.getElementById('cursor');
    if (cursor) { // Check if the element exists
        setInterval(() => {
            cursor.style.opacity = (cursor.style.opacity === '0' ? '1' : '0');
        }, 500);
    }
});