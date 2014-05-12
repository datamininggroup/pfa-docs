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
        var out = {"@": locator(ast.loc)};
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

    return {"attr": jsAstToExpression(walk), "path": reversedPath.reverse()};
}


function jsAstToExpression(ast) {
    if (ast.type == "Literal") {
        if (typeof ast.value == "string")
            return {"@": location(ast.loc), "string": ast.value};
        else
            return ast.value;
    }

    else if (ast.type == "Identifier")
        return ast.name;

    else if (ast.type == "MemberExpression") {
        var out = jsAstToAttrPath(ast);
        out["@"] = location(ast.loc);
        return out;
    }

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
            args.push(jsAstToExpression(ast.arguments[i]));

        var out = {"@": location(ast.loc)};
        out[fcnName] = args;
        return out;
    }

    else
        throw new Error("Javascript's \"" + ast.type + "\" construct has no PFA translation (yet)");
}

function jsAstToExpressions(ast) {
    var out = [];
    for (var i in ast) {
        if (ast[i].type == "ExpressionStatement")
            out.push(jsAstToExpression(ast[i].expression));

        else if (ast[i].type == "VariableDeclaration") {
            var pairs = {};

            for (var j in ast[i].declarations) {
                if (ast[i].declarations[j].type == "VariableDeclarator"  &&
                    ast[i].declarations[j].id.type == "Identifier") {
                    pairs[ast[i].declarations[j].id.name] = jsAstToExpression(ast[i].declarations[j].init);
                }
                else
                    throw new Error("unrecognized variable declaration l-value");
            }

            out.push({"@": location(ast[i].loc), "let": pairs});
        }

        else
            throw new Error("unrecognized statement");
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

            if (ast.body[i].expression.left.name == "input")
                out["input"] = jsAstToLiteralObject(ast.body[i].expression.right);

            else if (ast.body[i].expression.left.name == "output")
                out["output"] = jsAstToLiteralObject(ast.body[i].expression.right);

            else if (ast.body[i].expression.left.name == "method") {
                if (ast.body[i].expression.right.type == "Literal"  &&
                    typeof ast.body[i].expression.right.value == "string")
                    out["method"] = ast.body[i].expression.right.value;
                else if (ast.body[i].expression.right.type == "Identifier")
                    out["method"] = ast.body[i].expression.right.name;
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

