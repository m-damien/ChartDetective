export class Snackbar {

    static _createSnackDiv() : HTMLDivElement {
        var snackDiv = document.createElement("div");
        snackDiv.className = "snackbar show";
        return snackDiv;
    }

    static _addSnackDiv(snackDiv : HTMLDivElement) : void {
        var container = document.getElementById("snackbar-container");
        container.append(snackDiv);

        // Remove the div after a bit to avoid having too many "ghost divs"
       setTimeout(function() { 
            container.removeChild(snackDiv);
        }, 4000);
    }
    
    static addMessage(text : string, color : string = null, imgSrc : string = null) : void {
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
        this._addSnackDiv(snackDiv);
    }

    static addWarningMessage(text : string, imgSrc : string = null) : void {
        this.addMessage(text, "rgb(185, 62, 65)", imgSrc);
    }

    static addInfoMessage(text : string, imgSrc : string = null) : void {
        this.addMessage(text, null, imgSrc);
    }
}