// function useSpace() {
//     var engines = $(".engine");
//     engines.width($(window).width() - engines.offset().left - 20);
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

        if (x.className != "output") {
            cm.on("change", function(cm, changeObj) {
                var engine = $(cm.getTextArea().parentNode);
                if (!engine.running) {
                    var coverIcon = engine.find(".cover-icon");
                    var cover = engine.find(".cover");
                    coverIcon.attr("src", "/public/playbutton.gif");
                    coverIcon.css("visibility", "visible");
                    cover.css("visibility", "visible");
                }
            });
        }

        x.parentNode.running = false;
        x.cm = cm;

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
            if (!evt.currentTarget.parentNode.parentNode.running) {
                $(evt.currentTarget).find(".cover-icon").attr("src", "/public/playbutton-highlight.gif");
                $(evt.currentTarget).find(".cover-darkness").css("background", "rgba(0, 0, 0, 0.15)");
            }
        });
        cover.addEventListener("mouseout", function (evt) {
            if (!evt.currentTarget.parentNode.parentNode.running) {
                $(evt.currentTarget).find(".cover-icon").attr("src", "/public/playbutton.gif");
                $(evt.currentTarget).find(".cover-darkness").css("background", "rgba(0, 0, 0, 0.1)");
            }
        });
        cover.addEventListener("click", function (evt) {
            run(evt.currentTarget.parentNode.previousSibling.previousSibling.cm);
            });

        x.appendChild(cover);
    });

    // useSpace();
    // window.addEventListener("resize", useSpace);
}

function run(cm) {
    var engine = $(cm.getTextArea().parentNode);

    if (!engine[0].running) {
        engine[0].running = true;

        var coverIcon = engine.find(".cover-icon");
        var cover = engine.find(".cover");

        coverIcon.attr("src", "/public/icn_loading_animated.gif");
        coverIcon.css("visibility", "visible");
        cover.css("visibility", "visible");

        var input = engine.find(".input")[0].cm;
        var document = engine.find(".document")[0].cm;
        var output = engine.find(".output")[0].cm;

        var cmdom = output.getTextArea().nextSibling.nextSibling;

        var payload = {data: input.getValue(), format: "yaml", document: document.getValue()};
        $.post("http://pfa-gae.appspot.com/run",
               JSON.stringify(payload),
               function (data, textStatus, jqXHR) {
                   if (data.slice(0, 14) == "COMPILER-ERROR") {
                       var lines = data.trim().split("\n");
                       var errorClass = lines[1];
                       var errorMessage = lines[2];
                       coverIcon.attr("src", "/public/playbutton.gif");
                       coverIcon.css("visibility", "hidden");
                       cover.css("visibility", "visible");
                       cmdom.style.color = "red";
                       output.setValue(errorClass + ":\n" + errorMessage);
                   }
                   else {
                       coverIcon.attr("src", "/public/playbutton.gif");
                       coverIcon.css("visibility", "hidden");
                       cover.css("visibility", "hidden");
                       cmdom.style.color = "black";
                       output.setValue(data.trim());
                   }
                   engine[0].running = false;
               },
               "text");
    }
}

CodeMirror.commands["run"] = run;

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
