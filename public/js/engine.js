// function run(input, document, output) {
//     var payload = {data: input.html(), format: "yaml", document: document.html()};
//     $.post("http://pfa-gae.appspot.com/run",
//            JSON.stringify(payload),
//            function (data, textStatus, jqXHR) {
//                output.html(data);
//            },
//            "text");
// }

function setupEngines() {
    $(".input, .document, .output").each(function (i, x) {
        x.innerHTML = x.innerHTML.trim();

        if (x.className == "input") {
            var mode = "application/ld+json";
            var readOnly = false;
            var labelText = "input (JSONS)";
            var labelClass = "label label-input";
        }
        else if (x.className == "document") {
            var mode = "yaml";
            var readOnly = false;
            var labelText = "PFA document (YAML)";
            var labelClass = "label label-document";
        }
        else if (x.className == "output") {
            var mode = "text/plain";
            var readOnly = true;
            var labelText = "output (TEXT)";
            var labelClass = "label label-output";
        }

        var cm = CodeMirror.fromTextArea(x,
                                         {mode: mode,
                                          lineNumbers: true,
                                          smartIndent: true,
                                          tabSize: 2,
                                          indentUnit: 2,
                                          indentWithTabs: false,
                                          electricChars: false,
                                          lineWrapping: true,
                                          readOnly: readOnly,
                                          showCursorWhenSelecting: true,
                                          viewPortMargin: Infinity,
                                          keyMap: "custom"
                                         });

        if (x.className == "input") {
            x.nextSibling.style.marginTop = "-4px";
        }
        if (x.className == "output") {
            x.nextSibling.className = x.nextSibling.className + " output-cm";
        }

        var labellabel = document.createElement("div");
        labellabel.className = "labellabel";
        labellabel.innerHTML = labelText;
        var label = document.createElement("div");
        label.className = labelClass;
        label.appendChild(labellabel);
        x.parentNode.insertBefore(label, x.nextSibling);

        });

    $(".output-cm").each(function (i, x) {
        var coverDarkness = document.createElement("div");
        coverDarkness.className = "cover-darkness";

        var coverIcon = document.createElement("img");
        coverIcon.src = "/public/playbutton.gif";
        coverIcon.alt = "Calculate";
        coverIcon.className = "cover-icon";

        var cover = document.createElement("div");
        cover.className = "cover";
        cover.appendChild(coverDarkness);
        cover.appendChild(coverIcon);

        cover.addEventListener("mouseover", function (evt) {
            $(evt.currentTarget).find(".cover-icon").attr("src", "/public/playbutton-highlight.gif");
            $(evt.currentTarget).find(".cover-darkness").css("background", "rgba(0, 0, 0, 0.15)");
            });
        cover.addEventListener("mouseout", function (evt) {
            $(evt.currentTarget).find(".cover-icon").attr("src", "/public/playbutton.gif");
            $(evt.currentTarget).find(".cover-darkness").css("background", "rgba(0, 0, 0, 0.1)");
            });

        x.appendChild(cover);
    });
}

// CodeMirror.commands["run"] = run

CodeMirror.commands["newlineAndBack"] = function(cm) {
    cm.replaceSelection("\n", "end", "+input");
    cm.moveH(-1, "char");
}

CodeMirror.keyMap.custom = {
    "Left": "goCharLeft",
    "Right": "goCharRight",
    "Up": "goLineUp",
    "Down": "goLineDown",
    "PageUp": "goPageUp",
    "PageDown": "goPageDown",
    "Delete": "delCharAfter",
    "Backspace": "delCharBefore",
    "Insert": "toggleOverwrite",
    "Ctrl-F": "goCharRight",
    "Ctrl-B": "goCharLeft",
    "Ctrl-P": "goLineUp",
    "Ctrl-N": "goLineDown",
    "Alt-F": "goWordRight",
    "Alt-B": "goWordLeft",
    "Ctrl-A": "goLineStart",
    "Ctrl-E": "goLineEnd",
    "Ctrl-D": "delCharAfter",
    "Ctrl-H": "delCharBefore",
    "Alt-D": "delWordAfter",
    "Alt-Backspace": "delWordBefore",
    "Ctrl-K": "killLine",
    "Ctrl-T": "transposeChars",
    "Ctrl-O": "newlineAndBack",
    "Home": "goDocStart",
    "End": "goDocEnd",
    "Shift-Alt-,": "goDocStart",
    "Shift-Alt-.": "goDocEnd",
    "Alt-H": "delWordBefore",
    "Ctrl-Z": "undo",
    "Shift-Ctrl-Z": "redo",
    "Cmd-Z": "undo",
    "Shift-Cmd-Z": "redo",
    "Ctrl-[": "indentLess",
    "Ctrl-]": "indentMore",
    "Shift-Enter": "run",
};
