function location(loc) {
    return "JS lines " + loc.start.line + " to " + loc.end.line;
}

function jsAstToLiteralObject(ast) {
    if (ast.type == "Literal")
        return ast.value;
    else if (ast.type == "ArrayExpression") {
        var out = [];
        for (var i in ast.elements)
            out.push(jsAstToLiteralObject(ast.elements[i]));
        return out;
    }
    else if (ast.type == "ObjectExpression") {
        var out = {"@": location(ast.loc)};
        for (var k in ast.properties) {
            var key;
            if (ast.properties[k].type == "Property"  &&
                ast.properties[k].key.type == "Literal"  &&
                typeof ast.properties[k].key.value == "string")
                key = ast.properties[k].key.value;

            else if (ast.properties[k].type == "Property"  &&
                     ast.properties[k].key.type == "Identifier")
                key = ast.properties[k].key.name;

            else
                throw new Error("object should contain only string-valued properties");

            var value = jsAstToLiteralObject(ast.properties[k].value);
            out[key] = value;
        }
        return out;
    }
    else
        throw new Error("not a literal expression");
}

function jsAstToFunctionName(ast) {
    if (ast.type == "Identifier")
        return ast.name;
    else if (ast.type == "MemberExpression" && !ast.computed)
        return jsAstToFunctionName(ast.object) + "." + jsAstToFunctionName(ast.property);
    else
        throw new Error("illegal function name");
}

function jsAstToAttrPath(ast) {
    var reversedPath = [];

    var walk = ast;
    while (walk.type == "MemberExpression") {
        if (!walk.computed  &&  walk.property.type == "Identifier")
            reversedPath.push({"@": location(walk.property.loc), "string": walk.property.name});
        else if (walk.computed)
            reversedPath.push(jsAstToExpression(walk.property));
        else
            throw new Error("unrecognized member expression");
        walk = walk.object;
    }

    return {"@": location(ast.loc), "attr": jsAstToExpression(walk), "path": reversedPath.reverse()};
}

function jsAstToFcnDef(ast) {
    if (ast.type == "BinaryExpression"  &&
        ast.operator == ">>"  &&
        ast.left.type == "FunctionExpression"  &&
        ast.left.id == null  &&
        ast.left.params.length == ast.left.defaults.length  &&
        ast.left.body.type == "BlockStatement"  &&
        ast.left.rest == null  &&
        ast.left.generator == false  &&
        ast.left.expression == false) {

        var params = [];
        for (var i in ast.left.params) {
            var p = {};
            if (ast.left.params[i].type == "Identifier")
                p[ast.left.params[i].name] = jsAstToLiteralObject(ast.left.defaults[i]);
            params.push(p);
        }

        var ret = jsAstToLiteralObject(ast.right);
        var body = jsAstToExpressions(ast.left.body.body);

        return {"@": location(ast.loc), "params": params, "ret": ret, "do": body};
    }
    else
        throw new Error("function does not have the right form");
}

function jsAstToExpression(ast, allowFcn) {
    allowFcn = typeof allowFcn !== 'undefined' ? allowFcn : false;

    if (allowFcn) {
        if (ast.type == "BinaryExpression"  &&
            ast.operator == ">>"  &&
            ast.left.type == "FunctionExpression")
            return jsAstToFcnDef(ast);

        else if (ast.type == "CallExpression"  &&
                 ast.callee.type == "Identifier"  &&
                 ast.callee.name == "fcnref"  &&
                 ast.arguments.length == 1  &&
                 ast.arguments[0].type == "Literal"  &&
                 typeof ast.arguments[0].value == "string")
            return {"fcnref": ast.arguments[0].value};

        else if (ast.type == "CallExpression"  &&
                 ast.callee.type == "Identifier"  &&
                 ast.callee.name == "fcnref"  &&
                 ast.arguments.length == 1  &&
                 ast.arguments[0].type == "Identifier")
            return {"fcnref": ast.arguments[0].name};
    }

    if (ast.type == "Literal") {
        if (typeof ast.value == "string")
            return {"@": location(ast.loc), "string": ast.value};
        else
            return ast.value;
    }

    else if (ast.type == "Identifier")
        return ast.name;

    else if (ast.type == "MemberExpression")
        return jsAstToAttrPath(ast);

    else if (ast.type == "BinaryExpression") {
        var fcnName = ast.operator;
        if (fcnName == "%")
            fcnName = "%%";  // Javascript is like Fortran, C/C++, and Java in interpreting '%' as remainder, rather than modulo
        else if (fcnName == "&&")
            fcnName = "and";
        else if (fcnName == "||")
            fcnName = "or";

        if (["+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", "and", "or", "&", "^", "|"].indexOf(fcnName) == -1)
            throw new Error("Javascript's \"" + fcnName + "\" binary operator has no PFA translation (yet)");

        var out = {"@": location(ast.loc)};
        out[fcnName] = [jsAstToExpression(ast.left), jsAstToExpression(ast.right)];
        return out;
    }

    else if (ast.type == "UnaryExpression") {
        var fcnName = ast.operator;
        if (fcnName == "-")
            fcnName = "u-";
        else if (fcnName == "!")
            fcnName = "not";

        if (["u-", "not", "~"].indexOf(fcnName) == -1)
            throw new Error("Javascript's \"" + fcnName + "\" unary operator has no PFA translation (yet)");

        var out = {"@": location(ast.loc)};
        out[fcnName] = [jsAstToExpression(ast.argument)];
        return out;
    }

    else if (ast.type == "CallExpression") {
        var fcnName = jsAstToFunctionName(ast.callee);

        var args = [];
        for (var i in ast.arguments)
            args.push(jsAstToExpression(ast.arguments[i], true));

        var out = {"@": location(ast.loc)};

        if (fcnName == "cell") {
            if (args.length >= 1)
                out[fcnName] = args[0];
            if (args.length >= 2)
                out["path"] = args[1];
            if (args.length == 3)
                out["to"] = args[2];
            if (args.length == 0  ||  args.length > 3)
                throw new Error("\"cell\" takes 1-3 arguments");
        }
        if (fcnName == "pool") {
            if (args.length >= 1)
                out[fcnName] = args[0];
            if (args.length >= 2)
                out["path"] = args[1];
            if (args.length >= 3)
                out["to"] = args[2];
            if (args.length == 4)
                out["init"] = args[3];
            if (args.length == 0  ||  args.length > 4)
                throw new Error("\"pool\" takes 1-4 arguments");
        }
        else {
            out[fcnName] = args;
        }

        return out;
    }

    else if (ast.type == "NewExpression") {
        if (ast.callee.type != "Identifier")
            throw new Error("new must be used with an Array, Map, or Record constructor");
        if (ast.callee.name != "Array"  &&  ast.callee.name != "Map"  &&  ast.callee.name != "Record")
            throw new Error("Javascript's \"new\" operator can only be used to create PFA Arrays, Maps, or Records");
        if (ast.arguments.length != 2)
            throw new Error(ast.callee.name + " constructor has two arguments, value and type");
        if (ast.callee.name == "Array"  &&  ast.arguments[0].type != "ArrayExpression")
            throw new Error("first argument of an Array constructor must be a Javascript array (in square brackets)");
        if (ast.callee.name == "Map"  &&  ast.arguments[0].type != "ObjectExpression")
            throw new Error("first argument of a Map constructor must be a Javascript object (in curly brackets)");
        if (ast.callee.name == "Record"  &&  ast.arguments[0].type != "ObjectExpression")
            throw new Error("first argument of a Record constructor must be a Javascript object (in curly brackets)");

        var value;
        if (ast.callee.name == "Array") {
            value = [];
            for (var i in ast.arguments[0].elements)
                value.push(jsAstToExpression(ast.arguments[0].elements[i]));
        }
        else {
            value = {};
            for (var i in ast.arguments[0].properties) {
                var key;
                if (ast.arguments[0].properties[i].type == "Property"  &&
                    ast.arguments[0].properties[i].key.type == "Literal"  &&
                    typeof ast.arguments[0].properties[i].key.value == "string")
                    key = ast.arguments[0].properties[i].key.value;

                else if (ast.arguments[0].properties[i].type == "Property"  &&
                         ast.arguments[0].properties[i].key.type == "Identifier")
                    key = ast.arguments[0].properties[i].key.name;

                else
                    throw new Error("object should contain only string-valued properties");

                value[key] = jsAstToExpression(ast.arguments[0].properties[i].value);
            }
        }

        var type = jsAstToLiteralObject(ast.arguments[1]);

        return {"@": location(ast.loc), "new": value, "type": type};
    }

    else if (ast.type == "VariableDeclaration") {
        var pairs = {};

        for (var i in ast.declarations) {
            if (ast.declarations[i].type == "VariableDeclarator"  &&
                ast.declarations[i].id.type == "Identifier") {
                pairs[ast.declarations[i].id.name] = jsAstToExpression(ast.declarations[i].init);
            }
            else
                throw new Error("unrecognized variable declaration l-value");
        }

        return {"@": location(ast.loc), "let": pairs};
    }

    else if (ast.type == "AssignmentExpression") {
        if (ast.operator != "=")
            throw new Error("assignment with \"" + ast.expressions[i].operator + "\" rather than \"=\"");

        if (ast.left.type == "Identifier") {
            var pairs = {};
            pairs[ast.left.name] = jsAstToExpression(ast.right);
            return {"@": location(ast.loc), "set": pairs};
        }
        else if (ast.left.type == "MemberExpression") {
            var attr = jsAstToAttrPath(ast.left);
            var value = jsAstToExpression(ast.right, true);
            attr["to"] = value;
            return attr;
        }
    }

    else if (ast.type == "SequenceExpression"  &&
             ast.expressions.every(function (x) { return x.type == "AssignmentExpression"; })) {
        var pairs = {};

        for (var i in ast.expressions) {
            if (ast.expressions[i].operator != "=")
                throw new Error("assignment with \"" + ast.expressions[i].operator + "\" rather than \"=\"");
            if (ast.expressions[i].left.type != "Identifier")
                throw new Error("only simple identifiers allowed as lvalues in multi-assignments");
            pairs[ast.expressions[i].left.name] = jsAstToExpression(ast.expressions[i].right);
        }

        return {"@": location(ast.loc), "set": pairs};
    }

    else if (ast.type == "BlockStatement")
        return {"@": location(ast.loc), "do": jsAstToExpressions(ast.body)};

    else
        throw new Error("Javascript's \"" + ast.type + "\" construct has no PFA translation (yet)");
}

function jsAstToExpressions(ast) {
    var out = [];
    for (var i in ast) {
        if (ast[i].type == "ExpressionStatement")
            out.push(jsAstToExpression(ast[i].expression));

        else if (ast[i].type == "VariableDeclaration"  ||
                 ast[i].type == "AssignmentExpression"  ||
                 ast[i].type == "SequenceExpression"  ||
                 ast[i].type == "BlockStatement")
            out.push(jsAstToExpression(ast[i]));

        else if (ast[i].type == "EmptyStatement") { }

        else
            throw new Error("unrecognized statement: " + ast[i].type);
    }
    return out;
}

function jsToPfa(doc) {
    var ast = esprima.parse(doc, {loc: true});
    var out = {};

    for (var i in ast.body) {
        if (ast.body[i].type == "ExpressionStatement"  &&
            ast.body[i].expression.type == "AssignmentExpression"  &&
            ast.body[i].expression.operator == "="  &&
            ast.body[i].expression.left.type == "Identifier") {

            if (ast.body[i].expression.left.name == "name") {
                if (ast.body[i].expression.right.type == "Literal"  &&
                    typeof ast.body[i].expression.right.value == "string")
                    out["name"] = ast.body[i].expression.right.value;
                else
                    throw new Error("name must be a string");
            }

            else if (ast.body[i].expression.left.name == "method") {
                if (ast.body[i].expression.right.type == "Literal"  &&
                    typeof ast.body[i].expression.right.value == "string")
                    out["method"] = ast.body[i].expression.right.value;
                else if (ast.body[i].expression.right.type == "Identifier")
                    out["method"] = ast.body[i].expression.right.name;
                else
                    throw new Error("method must be a string");
            }

            else if (ast.body[i].expression.left.name == "input")
                out["input"] = jsAstToLiteralObject(ast.body[i].expression.right);

            else if (ast.body[i].expression.left.name == "output")
                out["output"] = jsAstToLiteralObject(ast.body[i].expression.right);

            else if (ast.body[i].expression.left.name == "begin") {
                if (ast.body[i].expression.right.type == "FunctionExpression"  &&
                    ast.body[i].expression.right.id == null  &&
                    ast.body[i].expression.right.rest == null  &&
                    ast.body[i].expression.right.generator == false  &&
                    ast.body[i].expression.right.expression == false  &&
                    ast.body[i].expression.right.params.length == 0  &&
                    ast.body[i].expression.right.defaults.length == 0  &&
                    ast.body[i].expression.right.body.type == "BlockStatement") {
                    out["begin"] = jsAstToExpressions(ast.body[i].expression.right.body.body);
                }
                else
                    throw new Error("begin must be a simple anonymous function");
            }

            else if (ast.body[i].expression.left.name == "action") {
                if (ast.body[i].expression.right.type == "FunctionExpression"  &&
                    ast.body[i].expression.right.id == null  &&
                    ast.body[i].expression.right.rest == null  &&
                    ast.body[i].expression.right.generator == false  &&
                    ast.body[i].expression.right.expression == false  &&
                    ast.body[i].expression.right.defaults.length == 0  &&
                    ast.body[i].expression.right.body.type == "BlockStatement") {
                    var hasInput = false;
                    var hasTally = false;
                    for (var j in ast.body[i].expression.right.params) {
                        if (ast.body[i].expression.right.params[j].type == "Identifier") {
                            var p = ast.body[i].expression.right.params[j].name;
                            if (p == "input") {
                                if (hasInput)
                                    throw new Error("\"input\" appears more than once in the action function's parameter list")
                                else
                                    hasInput = true;
                            }
                            else if (p == "tally") {
                                if (hasTally)
                                    throw new Error("\"tally\" appears more than once in the action function's parameter list")
                                else
                                    hasTally = true;
                            }
                            else
                                throw new Error("the only parameters allowed in the action function's parameter list are \"input\" and \"tally\"");
                        }
                        else
                            throw new Error("action parameters must be simple identifiers");
                    }

                    if (!hasInput)
                        throw new Error("action parameters must include \"input\"");

                    out["action"] = jsAstToExpressions(ast.body[i].expression.right.body.body);
                }
                else
                    throw new Error("action must be a simple anonymous function");
            }

            else if (ast.body[i].expression.left.name == "end") {
                if (ast.body[i].expression.right.type == "FunctionExpression"  &&
                    ast.body[i].expression.right.id == null  &&
                    ast.body[i].expression.right.rest == null  &&
                    ast.body[i].expression.right.generator == false  &&
                    ast.body[i].expression.right.expression == false  &&
                    ast.body[i].expression.right.params.length == 0  &&
                    ast.body[i].expression.right.defaults.length == 0  &&
                    ast.body[i].expression.right.body.type == "BlockStatement") {
                    out["end"] = jsAstToExpressions(ast.body[i].expression.right.body.body);
                }
                else
                    throw new Error("begin must be a simple anonymous function");
            }

            else if (ast.body[i].expression.left.name == "fcns") {
                if (ast.body[i].expression.right.type == "ObjectExpression") {
                    var pairs = {"@": location(ast.body[i].expression.right.loc)};
                    for (var k in ast.body[i].expression.right.properties) {
                        var key;
                        if (ast.body[i].expression.right.properties[k].type == "Property"  &&
                            ast.body[i].expression.right.properties[k].key.type == "Literal"  &&
                            typeof ast.body[i].expression.right.properties[k].key.value == "string")
                            key = ast.body[i].expression.right.properties[k].key.value;

                        else if (ast.body[i].expression.right.properties[k].type == "Property"  &&
                                 ast.body[i].expression.right.properties[k].key.type == "Identifier")
                            key = ast.body[i].expression.right.properties[k].key.name;

                        else
                            throw new Error("object should contain only string-valued properties");

                        var value = jsAstToFcnDef(ast.body[i].expression.right.properties[k].value);
                        pairs[key] = value;
                    }
                    out["fcns"] = pairs;
                }
            }

            else if (ast.body[i].expression.left.name == "zero")
                out["zero"] = jsAstToLiteralObject(ast.body[i].expression.right);

            else if (ast.body[i].expression.left.name == "cells")
                throw new Error("NOT IMPLEMENTED YET");   // FIXME

            else if (ast.body[i].expression.left.name == "pools")
                throw new Error("NOT IMPLEMENTED YET");   // FIXME

            else if (ast.body[i].expression.left.name == "randseed") {
                if (ast.body[i].expression.right.type == "Literal"  &&
                    typeof ast.body[i].expression.right.value == "number"  &&
                    ast.body[i].expression.right.value == Math.round(ast.body[i].expression.right.value))
                    out["randseed"] = ast.body[i].expression.right.value;
                else
                    throw new Error("randseed must be an integer");
            }

            else if (ast.body[i].expression.left.name == "doc") {
                if (ast.body[i].expression.right.type == "Literal"  &&
                    typeof ast.body[i].expression.right.value == "string")
                    out["doc"] = ast.body[i].expression.right.value;
                else
                    throw new Error("doc must be a string");
            }

            else if (ast.body[i].expression.left.name == "metadata")
                out["metadata"] = jsAstToLiteralObject(ast.body[i].expression.right);

            else if (ast.body[i].expression.left.name == "options"){
                if (ast.body[i].expression.right.type == "ObjectExpression") {
                    var pairs = {"@": location(ast.body[i].expression.right.loc)};
                    for (var k in ast.body[i].expression.right.properties) {
                        var key;
                        if (ast.body[i].expression.right.properties[k].type == "Property"  &&
                            ast.body[i].expression.right.properties[k].key.type == "Literal"  &&
                            typeof ast.body[i].expression.right.properties[k].key.value == "string")
                            key = ast.body[i].expression.right.properties[k].key.value;

                        else if (ast.body[i].expression.right.properties[k].type == "Property"  &&
                                 ast.body[i].expression.right.properties[k].key.type == "Identifier")
                            key = ast.body[i].expression.right.properties[k].key.name;

                        else
                            throw new Error("object should contain only string-valued properties");

                        var value = jsAstToLiteralObject(ast.body[i].expression.right.properties[k].value);
                        pairs[key] = value;
                    }
                    out["options"] = pairs;
                }
                else
                    throw new Error("options must be a map to JSON");
            }

            else
                throw new Error("unrecognized top-level field \"" + ast.body[i].expression.left.name + "\"");
        }
        else
            throw new Error("top-level statements must be PFA field assignments");
    }

    if (!("input" in out))
        throw new Error("missing input");

    if (!("output" in out))
        throw new Error("missing output");

    if (!("action" in out))
        throw new Error("missing action");

    return out;
}

