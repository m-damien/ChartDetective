export class Snackbar {

    static _createSnackDiv(): HTMLDivElement {
        var snackDiv = document.createElement("div");
        snackDiv.className = "snackbar show";
        return snackDiv;
    }

    static _addSnackDiv(snackDiv: HTMLDivElement): void {
        var container = document.getElementById("snackbar-container");
        container.append(snackDiv);

        // Remove the div after a bit to avoid having too many "ghost divs"
        setTimeout(function () {
            // only remove if it is still a child of container
            if (snackDiv.parentNode === container) {
                container.removeChild(snackDiv);
            }
        }, 4000);
    }

    static clear(): void {
        var container = document.getElementById("snackbar-container");
        container.innerHTML = "";
    }

    static addMessage(text: string, color: string = null, imgSrc: string = null, buttons: { [name: string]: () => void } = null): void {
        const snackDiv = this._createSnackDiv();

        if (color !== null) {
            snackDiv.style.backgroundColor = color;
        }

        if (imgSrc !== null) {
            const imgDiv = document.createElement("div");
            const img = document.createElement("img");
            img.src = imgSrc;
            imgDiv.append(img);
            snackDiv.append(imgDiv);
        }

        snackDiv.append(text);

        if (buttons !== null) {
            const buttonsDiv = document.createElement("div");
            for (const name in buttons) {
                const button = document.createElement("button");
                button.innerText = name;
                button.onclick = buttons[name];
                buttonsDiv.append(button);
            }
            snackDiv.append(buttonsDiv);
            buttonsDiv.style.pointerEvents = "auto"; // Should respond to clicks
        }

        this._addSnackDiv(snackDiv);
    }

    static addWarningMessage(text: string, imgSrc: string = null): void {
        this.addMessage(text, "rgb(185, 62, 65)", imgSrc);
    }

    static addInfoMessage(text: string, imgSrc: string = null): void {
        this.addMessage(text, null, imgSrc);
    }
}