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

function jsAstToExpression(ast) {
    if (ast.type == "Literal") {
        if (typeof ast.value == "string")
            return {"@": location(ast.loc), "string": ast.value};
        else
            return ast.value;
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
    }

    else
        throw new Error("Javascript's \"" + ast.type + "\" construct has no PFA translation (yet)");
}

function jsAstToExpressions(ast) {
    var out = [];
    for (var i in ast.elements) {
        out.push(jsAstToExpression(ast.elements[i]));
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

            else if (ast.body[i].expression.left.name == "action") {
                var subast = ast.body[i].expression.right;
                if (subast.type == "ArrayExpression")
                    out["action"] = jsAstToExpressions(subast);
                else
                    out["action"] = [jsAstToExpression(subast)];
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

