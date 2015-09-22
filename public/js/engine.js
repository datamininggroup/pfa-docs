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

        if (x.tagName == "TEXTAREA") {
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
        }

        if (x.className != "output") {
            cm.on("change", function(cm, changeObj) {
                var engine = $(cm.getTextArea().parentNode);
                if (!engine.running) {
                    var coverIcon = engine.find(".cover-icon");
                    var cover = engine.find(".cover");
                    coverIcon.attr("src", "/pfa/public/playbutton.gif");
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
        coverIcon.src = "/pfa/public/playbutton.gif";
        coverIcon.alt = "Calculate";
        coverIcon.className = "cover-icon";

        var cover = document.createElement("div");
        cover.className = "cover";
        cover.appendChild(coverDarkness);
        cover.appendChild(coverIcon);

        cover.addEventListener("mouseover", function (evt) {
            if (!evt.currentTarget.parentNode.parentNode.running) {
                $(evt.currentTarget).find(".cover-icon").attr("src", "/pfa/public/playbutton-highlight.gif");
                $(evt.currentTarget).find(".cover-darkness").css("background", "rgba(0, 0, 0, 0.15)");
            }
        });
        cover.addEventListener("mouseout", function (evt) {
            if (!evt.currentTarget.parentNode.parentNode.running) {
                $(evt.currentTarget).find(".cover-icon").attr("src", "/pfa/public/playbutton.gif");
                $(evt.currentTarget).find(".cover-darkness").css("background", "rgba(0, 0, 0, 0.1)");
            }
        });
        cover.addEventListener("click", function (evt) {
            run($(evt.currentTarget.parentNode.parentNode).find(".document")[0].cm);
        });

        x.appendChild(cover);
    });

    $(".engine").css("border", "solid 2px #dddddd");
}

function run(cm) {
    var engine = $(cm.getTextArea().parentNode);

    if (!engine[0].running) {
        engine[0].running = true;

        var coverIcon = engine.find(".cover-icon");
        var cover = engine.find(".cover");

        coverIcon.attr("src", "/pfa/public/icn_loading_animated.gif");
        coverIcon.css("visibility", "visible");
        cover.css("visibility", "visible");

        var input = (function () {
            var test = engine.find(".input");
            if (test.size() == 0) {
                return null;
            }
            else {
                return test[0].cm;
            }
        })();
        var doc = engine.find(".document")[0].cm;
        var output = engine.find(".output")[0].cm;

        var cmdom;
        var outputError;
        var outputPlot;
        var outputThePlot;
        if (output != undefined) {
            cmdom = output.getTextArea().nextSibling.nextSibling;
        }
        else {
            outputError = engine.find(".output-error")[0];
            outputPlot = engine.find(".output-plot")[0];
            outputThePlot = engine.find(".theplot")[0];
        }

        var payload;
        if (input == null) {
            payload = {dataset: engine.attr("dataset"), format: "yaml", document: doc.getValue()};
        }
        else {
            payload = {data: input.getValue(), format: "yaml", document: doc.getValue()};
        }

        var xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4  &&  xmlhttp.status == 200) {
                var data = xmlhttp.responseText;
                if (data.slice(0, 14) == "COMPILER-ERROR") {
                    var lines = data.trim().split("\n");
                    var errorClass = lines[1];
                    var errorMessage = lines.splice(2, lines.length).join("\n");
                    coverIcon.attr("src", "/pfa/public/playbutton.gif");
                    coverIcon.css("visibility", "hidden");
                    cover.css("visibility", "visible");
                    if (output != undefined) {
                        cmdom.style.color = "red";
                        output.setValue(errorClass + ":\n" + errorMessage);
                    }
                    else {
                        outputError.innerHTML = "";
                        outputError.appendChild(document.createTextNode(errorClass + ":\n" + errorMessage));
                        outputThePlot.innerHTML = "";
                    }
                }
                else {
                    coverIcon.attr("src", "/pfa/public/playbutton.gif");
                    coverIcon.css("visibility", "hidden");
                    cover.css("visibility", "hidden");
                    if (output != undefined) {
                        cmdom.style.color = "black";
                        output.setValue(data.trim());
                    }
                    else {
                        outputError.innerHTML = "";
                        outputThePlot.innerHTML = "";
                        makePlot(data, outputThePlot);
                    }
                }
                engine[0].running = false;
            }
        }
        xmlhttp.open("POST", "http://hadrian-gae.appspot.com/run", true);
        xmlhttp.setRequestHeader("Content-type", "text/plain");
        xmlhttp.send(JSON.stringify(payload));
    }
}

CodeMirror.commands["run"] = run;

CodeMirror.commands["newlineAndBack"] = function(cm) {
    cm.replaceSelection("\n", "end", "+input");
    cm.moveH(-1, "char");
};

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

function makePlot(text, div) {
    data = [];
    $(text.split("\n")).each(function (i, x) {
        try {
            var y = JSON.parse(x);
            data.push(y);
        }
        catch (err) {}
    });

    var margin = {top: 20, right: 20, bottom: 30, left: 40};
    var width = 600 - margin.left - margin.right;
    var height = 400 - margin.top - margin.bottom;
    var x = d3.scale.linear().range([0, width]);
    var y = d3.scale.linear().range([height, 0]);
    var xAxis = d3.svg.axis().scale(x).orient("bottom");
    var yAxis = d3.svg.axis().scale(y).orient("left");
    var svg = d3.select(div).append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + ", " + margin.top + ")");
    x.domain(d3.extent(data, function (d) { return d.x; })).nice();
    y.domain(d3.extent(data, function (d) { return d.y; })).nice();
    svg.append("g").attr("class", "x axis").attr("transform", "translate(0, " + height + ")").call(xAxis);
    svg.append("g").attr("class", "y axis").call(yAxis);
    svg.selectAll(".dot").data(data).enter().append("circle").attr("class", "dot").attr("r", function (d) { return d.radius; }).attr("cx", function (d) { return x(d.x); }).attr("cy", function (d) { return y(d.y); }).style("fill", function (d) { return "hsla(" + d.color*360.0 + ", 100%, 50%, " + d.opacity + ")" });
}
