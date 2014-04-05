/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/


"use strict";


/**
 * A general method to define Node Type of AST structure.
 *
 * @param {!String} type Node Type Name, such as `Token`.
 * @param {!String} props Property names stored in a array.
 * @param {!Object} methods Methods owned by this Class.
 * @param {!Object} base Parent Class.
 *
 * @return {!Function} ctor Constructor function
 */
function DEFNODE(type, props, methods, base) {
    // if not passed base argument
    // default to inherited from AST_Node.
    if (arguments.length < 4) 
        base = AST_Node;
    // get properties. props should be a string with whitespace
    if (!props) 
        props = [];
    else 
        props = props.split(/\s+/);
    
    var self_props = props;
    // all the properties of Parent Class should be showed
    // in the child Class.
    if (base && base.PROPS)
        props = props.concat(base.PROPS);

    var code = "return function AST_" + type + "(props){ if (props) { ";
    for (var i = props.length; --i >= 0;) {
        code += "this." + props[i] + " = props." + props[i] + ";";
    }
    var proto = base && new base;
    if (proto && proto.initialize || (methods && methods.initialize))
        code += "this.initialize();";
    code += "}}";

    // new Node Type Class's constructor function
    // i.e:
    // function AST_Token (props) {
    //     if (props) {
    //         this.xxx = props.xxx;
    //         this.yyy = props.yyy;
    //         this.initialize();
    //     }
    // }
    var ctor = new Function(code)();
    // establish prototype chain of parent-sub Class.
    if (proto) {
        ctor.prototype = proto;
        // store Parent Class Function 
        // in the static BASE attr.
        ctor.BASE = base;
    }
    if (base) 
        base.SUBCLASSES.push(ctor);

    // record some useful props & methods
    ctor.prototype.CTOR = ctor;
    ctor.PROPS = props || null;
    ctor.SELF_PROPS = self_props;
    ctor.SUBCLASSES = [];
    if (type) {
        ctor.prototype.TYPE = ctor.TYPE = type;
    }
    // method name started with `$` seem like a static method
    // otherwise it's a instance method.
    if (methods) for (i in methods) if (methods.hasOwnProperty(i)) {
        if (/^\$/.test(i)) {
            ctor[i.substr(1)] = methods[i];
        } else {
            ctor.prototype[i] = methods[i];
        }
    }
    ctor.DEFMETHOD = function(name, method) {
        this.prototype[name] = method;
    };
    return ctor;
};


/** 
 * definition of AST_Token
 * Notice the attrs array.
 */
var AST_Token = DEFNODE("Token", "type value line col pos endpos nlb comments_before file", {
}, null);


/** 
 * definition of AST_Node
 */
var AST_Node = DEFNODE("Node", "start end", {
    // can do a clone in this way depend on the realization of
    // ctor constructor function.
    clone: function() {
        return new this.CTOR(this);
    },
    $documentation: "Base class of all AST nodes",
    $propdoc: {
        start: "[AST_Token] The first token of this node",
        end: "[AST_Token] The last token of this node"
    },
    _walk: function(visitor) {
        return visitor._visit(this);
    },
    // visitor must be a instance of `TreeWalker` Class used for 
    // traversing AST_Node. visitor should have a _visit method.
    walk: function(visitor) {
        return this._walk(visitor); // not sure the indirection will be any help
    }
}, null);


// do a warning
AST_Node.warn_function = null;


/**
 * use warn_function to pop up a message.
 * @param {!String} txt
 * @param {!Object} props
 */
AST_Node.warn = function(txt, props) {
    if (AST_Node.warn_function)
        AST_Node.warn_function(string_template(txt, props));
};


/* -----[ statements ]----- */
/**
 * definition of AST_Statement
 */
var AST_Statement = DEFNODE("Statement", null, {
    $documentation: "Base class of all statements",
});


/** 
 * definition of AST_Debugger.
 * I notice that ECMA262 debugger is built-in statement, 
 * named debugger-statement.
 */
var AST_Debugger = DEFNODE("Debugger", null, {
    $documentation: "Represents a debugger statement",
}, AST_Statement);


/** 
 * definition of AST_Directive
 * At present, read from ecma-262, there is only `use strict` directive
 */
var AST_Directive = DEFNODE("Directive", "value scope", {
    $documentation: "Represents a directive, like \"use strict\";",
    $propdoc: {
        value: "[string] The value of this directive as a plain string (it's not an AST_String!)",
        scope: "[AST_Scope/S] The scope that this directive affects"
    },
}, AST_Statement);


/** 
 * definition of AST_SimpleStatement
 * I wonder `a = 1 + 2` is a simple statement.
 */
var AST_SimpleStatement = DEFNODE("SimpleStatement", "body", {
    $documentation: "A statement consisting of an expression, i.e. a = 1 + 2",
    $propdoc: {
        // I do not know what is a `expression node`....
        // seems like a node-collection
        body: "[AST_Node] an expression node (should not be instanceof AST_Statement)"
    },
    _walk: function(visitor) {
        // todo: need to know the second argument for what
        // seems like a recursion-callback
        return visitor._visit(this, function(){
            this.body._walk(visitor);
        });
    }
}, AST_Statement);


/* -----[ AST_Block and its SubClasses ]----- */

/**
 * It is a utility function!
 * walk the body of AST_Block, for different conditions.
 * If node is a AST_Statement or a collection of AST_Statement.
 *
 * @param {!(AST_Statement|Array.<AST_Statement>)} node
 * @param {!TreeWalker} visitor
 */
function walk_body(node, visitor) {
    // Does it mean just simple { a = 1 + 2 } ??
    if (node.body instanceof AST_Statement) {
        node.body._walk(visitor);
    } else node.body.forEach(function(stat){
        stat._walk(visitor);
    });
};


/** 
 * AST_Block节点 (by zmike86)
 * 这个节点很重要, 但疑惑两点: 
 *   a. why inherited from AST_Statement
 *   b. AST_VarDef, AST_Call and so on are not subclasses  
 *      of AST_Statement
 *
 * as described there, AST_Block usually represents a 
 * series statements wrapped by a `{` and `}`.
 * But there are several conditions. i.e:
 * simple `{}`, switch's `{}`, function body's `{}`,
 * they are all subclass of AST_Block so far.
 */
var AST_Block = DEFNODE("Block", "body", {
    $documentation: "A body of statements (usually bracketed)",
    $propdoc: {
        body: "[AST_Statement*] an array of statements"
    },
    // visitor is a TreeWalker instance.
    // And AST_Block's _walk method use walk_body function
    // instead.
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            walk_body(this, visitor);
        });
    }
}, AST_Statement);


/**
 * definition of AST_BlockStatement
 * it's the common block statements.
 */
var AST_BlockStatement = DEFNODE("BlockStatement", null, {
    $documentation: "A block statement",
}, AST_Block);


/* -----[ scope and functions ]----- */

/**
 * definition of AST_Scope (by zmike86)
 * Worth to note that AST_Scope is a subclass of AST_Block. And the `enclosed` property, which means all
 * SymbolDef at this scope and other scope but can be access by this scope.
 * cname .... what's mangling variables?
 */
var AST_Scope = DEFNODE("Scope", "directives variables functions uses_with uses_eval parent_scope enclosed cname", {
    $documentation: "Base class for all statements introducing a lexical scope",
    $propdoc: {
        directives: "[string*/S] an array of directives declared in this scope",
        variables: "[Object/S] a map of name -> SymbolDef for all variables/functions defined in this scope",
        functions: "[Object/S] like `variables`, but only lists function declarations",
        uses_with: "[boolean/S] tells whether this scope uses the `with` statement",
        uses_eval: "[boolean/S] tells whether this scope contains a direct call to the global `eval`",
        parent_scope: "[AST_Scope?/S] link to the parent scope",
        enclosed: "[SymbolDef*/S] a list of all symbol definitions that are accessed from this scope or any subscopes",
        cname: "[integer/S] current index for mangling variables (used internally by the mangler)",
    },
}, AST_Block);


/**
 * definition of AST_Toplevel
 * 这是顶级作用域节点. 除了正常scope应有的属性外还留有globals这样的全局变量池.
 * 这个对象应该是个单例
 */
var AST_Toplevel = DEFNODE("Toplevel", "globals", {
    $documentation: "The toplevel scope",
    $propdoc: {
        // But this condition should be avoided so that `use strict` won't produce an
        // Error, and it's not a good practice.
        globals: "[Object/S] a map of name -> SymbolDef for all undeclared names",
    },
    /**
     * todo:
     * wrap a piece of code, give the common js wrapper.
     *
     * @param {string} name
     * @param {boolean} export_all 是否把属性全部导出到全局对象上
     */
    wrap_commonjs: function(name, export_all) {
        var self = this;
        // if want to export all properties to global.
        if (export_all) {
            // resolve this's scope
            self.figure_out_scope();

            var to_export = [];
            // instantiate a Walker as visitor
            self.walk(new TreeWalker(function(node){
                // ensure it's a global variable
                if (node instanceof AST_SymbolDeclaration && node.definition().global) {
                    // filter the to_export if there is no variable that equal the node
                    // then push the node in it.
                    if (!find_if(function(n){ return n.name == node.name }, to_export))
                        to_export.push(node);
                }
            }));
        }

        // it's a function template, where has two placeholder `$ORIG` and `$EXPORT` 
        var wrapped_tl = "(function(exports, global){ global['" + name + "'] = exports; '$ORIG'; '$EXPORTS'; }({}, (function(){return this}())))";

        // todo: what its logical and what does it return
        // where does `parse` function comes from
        wrapped_tl = parse(wrapped_tl);

        // todo: what its logical and what does it return
        wrapped_tl = wrapped_tl.transform(new TreeTransformer(function before(node){
            if (node instanceof AST_SimpleStatement) {
                node = node.body;
                if (node instanceof AST_String) switch (node.getValue()) {
                  case "$ORIG":
                    return MAP.splice(self.body);
                  case "$EXPORTS":
                    var body = [];
                    to_export.forEach(function(sym){
                        body.push(new AST_SimpleStatement({
                            body: new AST_Assign({
                                left: new AST_Sub({
                                    expression: new AST_SymbolRef({ name: "exports" }),
                                    property: new AST_String({ value: sym.name }),
                                }),
                                operator: "=",
                                right: new AST_SymbolRef(sym),
                            }),
                        }));
                    });
                    return MAP.splice(body);
                }
            }
        }));

        return wrapped_tl;
    }
}, AST_Scope);


/** 
 * definition of AST_Lambda
 * In JavaScript, anonymous function produce a new scope,
 * this lambda represents as AST_Lambda.
 */
var AST_Lambda = DEFNODE("Lambda", "name argnames uses_arguments", {
    $documentation: "Base class for functions",
    $propdoc: {
        name: "[AST_SymbolDeclaration?] the name of this function",
        argnames: "[AST_SymbolFunarg*] array of function arguments",
        uses_arguments: "[boolean/S] tells whether this function accesses the arguments array"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            if (this.name) 
                this.name._walk(visitor);
            this.argnames.forEach(function(arg){
                arg._walk(visitor);
            });
            walk_body(this, visitor);
        });
    }
}, AST_Scope);


/** 
 * definition of AST_Accessor
 * A function can be looked as a getter/setter function
 * if it plays the `value access` role, actually it's a
 * couple of hidden methods of current object. 
 * For more information, see here:
 * `http://ejohn.org/blog/javascript-getters-and-setters/`
 */
var AST_Accessor = DEFNODE("Accessor", null, {
    $documentation: "A setter/getter function"
}, AST_Lambda);


/**
 * definition of AST_Function
 * JavaScript Function Expression is a statement like:
 * var ast = function () {};
 */
var AST_Function = DEFNODE("Function", null, {
    $documentation: "A function expression"
}, AST_Lambda);


/**
 * definition of AST_Defun
 * JavaScript Function Declaration is a statement like:
 * function ast () {};
 */
var AST_Defun = DEFNODE("Defun", null, {
    $documentation: "A function definition"
}, AST_Lambda);


/* -----[ SWITCH ]----- */

/**
 * definition of AST_Switch
 * represents a `switch clause`
 */
var AST_Switch = DEFNODE("Switch", "expression", {
    $documentation: "A `switch` statement",
    $propdoc: {
        expression: "[AST_Node] the `switch` “discriminant”"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.expression._walk(visitor);
            walk_body(this, visitor);
        });
    }
}, AST_Block);


/**
 * definition of AST_SwitchBranch
 * It's an Abstract Class.
 */
var AST_SwitchBranch = DEFNODE("SwitchBranch", null, {
    $documentation: "Base class for `switch` branches",
}, AST_Block);


/**
 * definition of AST_Default
 */
var AST_Default = DEFNODE("Default", null, {
    $documentation: "A `default` switch branch",
}, AST_SwitchBranch);


/**
 * definition of AST_Case
 */
var AST_Case = DEFNODE("Case", "expression", {
    $documentation: "A `case` switch branch",
    $propdoc: {
        expression: "[AST_Node] the `case` expression"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function () {
            this.expression._walk(visitor);
            walk_body(this, visitor);
        });
    }
}, AST_SwitchBranch);


/* -----[ EXCEPTIONS ]----- */

/**
 * definition of AST_Try
 */
var AST_Try = DEFNODE("Try", "bcatch bfinally", {
    $documentation: "A `try` statement",
    $propdoc: {
        bcatch: "[AST_Catch?] the catch block, or null if not present",
        bfinally: "[AST_Finally?] the finally block, or null if not present"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function () {
            walk_body(this, visitor);
            if (this.bcatch) 
                this.bcatch._walk(visitor);
            if (this.bfinally) 
                this.bfinally._walk(visitor);
        });
    }
}, AST_Block);


// XXX: this is wrong according to ECMA-262 (12.4).  the catch block
// should introduce another scope, as the argname should be visible
// only inside the catch block.  However, doing it this way because of
// IE which simply introduces the name in the surrounding scope.  If
// we ever want to fix this then AST_Catch should inherit from
// AST_Scope.
/** todo (by zmike86)
 * In my test, IE actually do not introduce another scope.
 * But it has been verified through this demonstration:
 * `http://lisperator.net/uglifyjs/ast`
 */
var AST_Catch = DEFNODE("Catch", "argname", {
    $documentation: "A `catch` node; only makes sense as part of a `try` statement",
    $propdoc: {
        argname: "[AST_SymbolCatch] symbol for the exception"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.argname._walk(visitor);
            walk_body(this, visitor);
        });
    }
}, AST_Block);


/**
 * definition of AST_Finally finally语句块
 */
var AST_Finally = DEFNODE("Finally", null, {
    $documentation: "A `finally` node; only makes sense as part of a `try` statement"
}, AST_Block);


/* -----[ END AST_Block and its SubClasses ]----- */

/**
 * definition of AST_EmptyStatement
 */
var AST_EmptyStatement = DEFNODE("EmptyStatement", null, {
    $documentation: "The empty statement (empty block or simply a semicolon)",
    // could this mothed inherited from AST_Node??
    _walk: function(visitor) {
        return visitor._visit(this);
    }
}, AST_Statement);


/**
 * definition of AST_StatementWithBody
 */
var AST_StatementWithBody = DEFNODE("StatementWithBody", "body", {
    $documentation: "Base class for all statements that contain one nested body: `For`, `ForIn`, `Do`, `While`, `With`",
    $propdoc: {
        body: "[AST_Statement] the body; this should always be present, even if it's an AST_EmptyStatement"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.body._walk(visitor);
        });
    }
}, AST_Statement);


/**
 * definition of AST_LabeledStatement
 */
var AST_LabeledStatement = DEFNODE("LabeledStatement", "label", {
    $documentation: "Statement with a label",
    $propdoc: {
        label: "[AST_Label] a label definition"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.label._walk(visitor);
            this.body._walk(visitor);
        });
    }
}, AST_StatementWithBody);


/**
 * definition of AST_DWLoop
 */
var AST_DWLoop = DEFNODE("DWLoop", "condition", {
    $documentation: "Base class for do/while statements",
    $propdoc: {
        condition: "[AST_Node] the loop condition.  Should not be instanceof AST_Statement"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.condition._walk(visitor);
            this.body._walk(visitor);
        });
    }
}, AST_StatementWithBody);


/**
 * definition of AST_Do
 */
var AST_Do = DEFNODE("Do", null, {
    $documentation: "A `do` statement",
}, AST_DWLoop);


/**
 * definition of AST_While
 */
var AST_While = DEFNODE("While", null, {
    $documentation: "A `while` statement",
}, AST_DWLoop);


/**
 * definition of AST_For
 */
var AST_For = DEFNODE("For", "init condition step", {
    $documentation: "A `for` statement",
    $propdoc: {
        init: "[AST_Node?] the `for` initialization code, or null if empty",
        condition: "[AST_Node?] the `for` termination clause, or null if empty",
        step: "[AST_Node?] the `for` update clause, or null if empty"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function () {
            if (this.init) this.init._walk(visitor);
            if (this.condition) this.condition._walk(visitor);
            if (this.step) this.step._walk(visitor);
            this.body._walk(visitor);
        });
    }
}, AST_StatementWithBody);


/** 
 * definition of AST_ForIn
 */
var AST_ForIn = DEFNODE("ForIn", "init name object", {
    $documentation: "A `for ... in` statement",
    $propdoc: {
        init: "[AST_Node] the `for/in` initialization code",
        name: "[AST_SymbolRef?] the loop variable, only if `init` is AST_Var",
        object: "[AST_Node] the object that we're looping through"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function () {
            this.init._walk(visitor);
            this.object._walk(visitor);
            this.body._walk(visitor);
        });
    }
}, AST_StatementWithBody);


/**
 * definition of AST_With
 */
var AST_With = DEFNODE("With", "expression", {
    $documentation: "A `with` statement",
    $propdoc: {
        expression: "[AST_Node] the `with` expression"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.expression._walk(visitor);
            this.body._walk(visitor);
        });
    }
}, AST_StatementWithBody);


/* -----[ IF ]----- */

/**
 * definition of AST_If
 * represents a `if clause` condition in the parentheses
 * and alternative in the else clause.
 */
var AST_If = DEFNODE("If", "condition alternative", {
    $documentation: "A `if` statement",
    $propdoc: {
        condition: "[AST_Node] the `if` condition",
        alternative: "[AST_Statement?] the `else` part, or null if not present"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.condition._walk(visitor);
            this.body._walk(visitor);
            if (this.alternative) 
                this.alternative._walk(visitor);
        });
    }
}, AST_StatementWithBody);


/* -----[ JUMPS ]----- */

/**
 * definition of AST_Jump
 */
var AST_Jump = DEFNODE("Jump", null, {
    $documentation: "Base class for “jumps” (for now that's `return`, `throw`, `break` and `continue`)"
}, AST_Statement);


/**
 * definition of AST_Exit
 */
var AST_Exit = DEFNODE("Exit", "value", {
    $documentation: "Base class for “exits” (`return` and `throw`)",
    $propdoc: {
        value: "[AST_Node?] the value returned or thrown by this statement; could be null for AST_Return"
    },
    _walk: function(visitor) {
        return visitor._visit(this, this.value && function () {
            this.value._walk(visitor);
        });
    }
}, AST_Jump);


/**
 * definition of AST_Return
 */
var AST_Return = DEFNODE("Return", null, {
    $documentation: "A `return` statement"
}, AST_Exit);


/**
 * definition of AST_Throw
 */
var AST_Throw = DEFNODE("Throw", null, {
    $documentation: "A `throw` statement"
}, AST_Exit);


/**
 * definition of AST_LoopControl
 */
var AST_LoopControl = DEFNODE("LoopControl", "label", {
    $documentation: "Base class for loop control statements (`break` and `continue`)",
    $propdoc: {
        label: "[AST_LabelRef?] the label, or null if none",
    },
    _walk: function(visitor) {
        return visitor._visit(this, this.label && function () {
            this.label._walk(visitor);
        });
    }
}, AST_Jump);


/**
 * definition of AST_Break
 * Break could followed by a label name, but the relative label
 * have been moved to the base class LoopControl.
 */
var AST_Break = DEFNODE("Break", null, {
    $documentation: "A `break` statement"
}, AST_LoopControl);


/**
 * definition of AST_Continue
 */
var AST_Continue = DEFNODE("Continue", null, {
    $documentation: "A `continue` statement"
}, AST_LoopControl);


/* -----[ VAR/CONST ]----- */

/**
 * AST_Definition
 * Include variables definitions
 */
var AST_Definitions = DEFNODE("Definitions", "definitions", {
    $documentation: "Base class for `var` or `const` nodes (variable declarations/initializations)",
    $propdoc: {
        definitions: "[AST_VarDef*] array of variable definitions"
    },
    _walk: function (visitor) {
        return visitor._visit(this, function () {
            this.definitions.forEach(function (def) {
                def._walk(visitor);
            });
        });
    }
}, AST_Statement);


/**
 * AST_Var
 */
var AST_Var = DEFNODE("Var", null, {
    $documentation: "A `var` statement"
}, AST_Definitions);


/**
 * AST_Const 
 * If a variable declared with const keyword, it is a constant
 * symbol, can not be modified. eg: const f = 5;
 */
var AST_Const = DEFNODE("Const", null, {
    $documentation: "A `const` statement"
}, AST_Definitions);


/**
 * AST_VarDef
 */
var AST_VarDef = DEFNODE("VarDef", "name value", {
    $documentation: "A variable declaration; only appears in a AST_Definitions node",
    $propdoc: {
        name: "[AST_SymbolVar|AST_SymbolConst] name of the variable",
        value: "[AST_Node?] initializer, or null of there's no initializer"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function () {
            this.name._walk(visitor);
            if (this.value) this.value._walk(visitor);
        });
    }
});


/* -----[ OTHER ]----- */

/**
 * AST_Call
 */
var AST_Call = DEFNODE("Call", "expression args", {
    $documentation: "A function call expression",
    $propdoc: {
        expression: "[AST_Node] expression to invoke as function",
        args: "[AST_Node*] array of arguments"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function () {
            this.expression._walk(visitor);
            this.args.forEach(function (arg) {
                arg._walk(visitor);
            });
        });
    }
});


/**
 * AST_New
 */
var AST_New = DEFNODE("New", null, {
    $documentation: "An object instantiation.  Derives from a function call since it has exactly the same properties"
}, AST_Call);


/**
 * AST_Seq
 * Seems like a comma expression, but there is only two sub-expression,
 * because AST_Seq can be deeply nested.
 * methods start with `$` are static method.
 */
var AST_Seq = DEFNODE("Seq", "car cdr", {
    $documentation: "A sequence expression (two comma-separated expressions)",
    $propdoc: {
        car: "[AST_Node] first element in sequence",
        cdr: "[AST_Node] second element in sequence"
    },
    $cons: function (x, y) {
        var seq = new AST_Seq(x);
        // decide the sequence of arguments mapping to 
        // comma-expressions.
        seq.car = x;
        seq.cdr = y;
        return seq;
    },
    $from_array: function (array) {
        if (array.length == 0) return null;
        if (array.length == 1) return array[0].clone();
        var list = null;
        // So, array --> [expr1, expr2, expr3] would be converted to
        // (expr1, (expr2, (expr3, undefined))) as a seq instance.
        // represented by list:
        for (var i = array.length; --i >= 0;) {
            list = AST_Seq.cons(array[i], list);
        }
        // p and list are the same reference
        var p = list;
        while (p) {
            if (p.cdr && !p.cdr.cdr) {
                p.cdr = p.cdr.car;
                break;
            }
            p = p.cdr;
        }
        // p and list are all the same, there are:
        // (expr2, expr3):: AST_Seq;
        // But ... why not just extrieve the last two values
        // of the array?
        return list;
    },
    to_array: function () {
        var p = this, a = [];
        while (p) {
            a.push(p.car);
            if (p.cdr && !(p.cdr instanceof AST_Seq)) {
                a.push(p.cdr);
                break;
            }
            p = p.cdr;
        }
        return a;
    },
    add: function (node) {
        var p = this;
        while (p) {
            if (!(p.cdr instanceof AST_Seq)) {
                var cell = AST_Seq.cons(p.cdr, node);
                return p.cdr = cell;
            }
            p = p.cdr;
        }
    },
    _walk: function (visitor) {
        return visitor._visit(this, function () {
            // if the car is undefined or falsy value??
            this.car._walk(visitor);
            if (this.cdr) this.cdr._walk(visitor);
        });
    }
});


/**
 * AST_PropAccess
 */
var AST_PropAccess = DEFNODE("PropAccess", "expression property", {
    $documentation: "Base class for property access expressions, i.e. `a.foo` or `a[\"foo\"]`",
    $propdoc: {
        expression: "[AST_Node] the “container” expression",
        property: "[AST_Node|string] the property to access.  For AST_Dot this is always a plain string, while for AST_Sub it's an arbitrary AST_Node"
    }
});


/**
 * AST_Dot
 */
var AST_Dot = DEFNODE("Dot", null, {
    $documentation: "A dotted property access expression",
    _walk: function (visitor) {
        return visitor._visit(this, function () {
            this.expression._walk(visitor);
        });
    }
}, AST_PropAccess);


/**
 * AST_Dot
 */
var AST_Sub = DEFNODE("Sub", null, {
    $documentation: "Index-style property access, i.e. `a[\"foo\"]`",
    _walk: function (visitor) {
        return visitor._visit(this, function () {
            this.expression._walk(visitor);
            this.property._walk(visitor);
        });
    }
}, AST_PropAccess);


/**
 * AST_Unary
 */
var AST_Unary = DEFNODE("Unary", "operator expression", {
    $documentation: "Base class for unary expressions",
    $propdoc: {
        operator: "[string] the operator",
        expression: "[AST_Node] expression that this unary operator applies to"
    },
    _walk: function (visitor) {
        return visitor._visit(this, function () {
            this.expression._walk(visitor);
        });
    }
});


/**
 * AST_UnaryPrefix
 */
var AST_UnaryPrefix = DEFNODE("UnaryPrefix", null, {
    $documentation: "Unary prefix expression, i.e. `typeof i` or `++i`"
}, AST_Unary);


/**
 * AST_UnaryPostfix
 */
var AST_UnaryPostfix = DEFNODE("UnaryPostfix", null, {
    $documentation: "Unary postfix expression, i.e. `i++`"
}, AST_Unary);


/**
 * AST_Binary
 * Binary operators statements. The operator is a plain string.
 */
var AST_Binary = DEFNODE("Binary", "left operator right", {
    $documentation: "Binary expression, i.e. `a + b`",
    $propdoc: {
        left: "[AST_Node] left-hand side expression",
        operator: "[string] the operator",
        right: "[AST_Node] right-hand side expression"
    },
    _walk: function (visitor) {
        return visitor._visit(this, function () {
            this.left._walk(visitor);
            this.right._walk(visitor);
        });
    }
});


/**
 * AST_Assign
 */
var AST_Assign = DEFNODE("Assign", null, {
    $documentation: "An assignment expression — `a = b + 5`",
}, AST_Binary);


/**
 * AST_Conditional.
 * Trible operator statements. It's in fact an Expression.
 */
var AST_Conditional = DEFNODE("Conditional", "condition consequent alternative", {
    $documentation: "Conditional expression using the ternary operator, i.e. `a ? b : c`",
    $propdoc: {
        condition: "[AST_Node]",
        consequent: "[AST_Node]",
        alternative: "[AST_Node]"
    },
    _walk: function (visitor) {
        return visitor._visit(this, function () {
            this.condition._walk(visitor);
            this.consequent._walk(visitor);
            this.alternative._walk(visitor);
        });
    }
});


/* -----[ LITERALS ]----- */

/**
 * AST_Array
 */
var AST_Array = DEFNODE("Array", "elements", {
    $documentation: "An array literal",
    $propdoc: {
        elements: "[AST_Node*] array of elements"
    },
    _walk: function (visitor) {
        return visitor._visit(this, function () {
            this.elements.forEach(function (el) {
                el._walk(visitor);
            });
        });
    }
});


/**
 * AST_Object
 */
var AST_Object = DEFNODE("Object", "properties", {
    $documentation: "An object literal",
    $propdoc: {
        properties: "[AST_ObjectProperty*] array of properties"
    },
    _walk: function (visitor) {
        return visitor._visit(this, function () {
            this.properties.forEach(function (prop) {
                prop._walk(visitor);
            });
        });
    }
});


/**
 * AST_Object
 */
var AST_ObjectProperty = DEFNODE("ObjectProperty", "key value", {
    $documentation: "Base class for literal object properties",
    $propdoc: {
        key: "[string] the property name; it's always a plain string in our AST, no matter if it was a string, number or identifier in original code",
        value: "[AST_Node] property value.  For setters and getters this is an AST_Function."
    },
    _walk: function (visitor) {
        return visitor._visit(this, function () {
            this.value._walk(visitor);
        });
    }
});


/**
 * AST_ObjectKeyVal
 */
var AST_ObjectKeyVal = DEFNODE("ObjectKeyVal", null, {
    $documentation: "A key: value object property",
}, AST_ObjectProperty);


/**
 * AST_ObjectSetter
 * In javascript 1.8, we can use `set` and `get` keyword to define 
 * an object's [gs]etter function. eg:
 * {
 *    value: 10, 
 *    set setValue (v) {this.value = v;},   
 *    get getValue () {return this.value;}
 * }
 */
var AST_ObjectSetter = DEFNODE("ObjectSetter", null, {
    $documentation: "An object setter property",
}, AST_ObjectProperty);


/**
 * AST_ObjectGetter
 */
var AST_ObjectGetter = DEFNODE("ObjectGetter", null, {
    $documentation: "An object getter property",
}, AST_ObjectProperty);


/**
 * AST_Symbol
 */
var AST_Symbol = DEFNODE("Symbol", "scope name thedef", {
    $propdoc: {
        name: "[string] name of this symbol",
        scope: "[AST_Scope/S] the current scope (not necessarily the definition scope)",
        thedef: "[SymbolDef/S] the definition of this symbol"
    },
    $documentation: "Base class for all symbols",
});


/**
 * AST_SymbolAccessor
 * todo: (by zmike86)
 */
var AST_SymbolAccessor = DEFNODE("SymbolAccessor", null, {
    $documentation: "The name of a property accessor (setter/getter function)"
}, AST_Symbol);


/**
 * AST_SymbolDeclaration
 */
var AST_SymbolDeclaration = DEFNODE("SymbolDeclaration", "init", {
    $documentation: "A declaration symbol (symbol in var/const, function name or argument, symbol in catch)",
    $propdoc: {
        init: "[AST_Node*/S] array of initializers for this declaration."
    }
}, AST_Symbol);


/**
 * AST_SymbolVar
 */
var AST_SymbolVar = DEFNODE("SymbolVar", null, {
    $documentation: "Symbol defining a variable",
}, AST_SymbolDeclaration);


/**
 * AST_SymbolFunarg
 * It's the name of argument. Inherited from AST_SymbolVar.
 */
var AST_SymbolFunarg = DEFNODE("SymbolFunarg", null, {
    $documentation: "Symbol naming a function argument",
}, AST_SymbolVar);


/**
 * AST_SymbolConst
 */
var AST_SymbolConst = DEFNODE("SymbolConst", null, {
    $documentation: "A constant declaration"
}, AST_SymbolDeclaration);


/**
 * AST_SymbolDefun
 * Is it a keyword `function`?? Seems not. It should be 
 * the named function's name.
 */
var AST_SymbolDefun = DEFNODE("SymbolDefun", null, {
    $documentation: "Symbol defining a function",
}, AST_SymbolDeclaration);


/**
 * AST_SymbolLambda.
 * (by zmike86) For example, var fn = function () {};
 * then fn is a variable reference a anonymous function.
 * fn is the symbol of the function expression.
 */
var AST_SymbolLambda = DEFNODE("SymbolLambda", null, {
    $documentation: "Symbol naming a function expression",
}, AST_SymbolDeclaration);


/**
 * AST_SymbolCatch.
 * It's the exception's name which been catched by the catch clause.
 */
var AST_SymbolCatch = DEFNODE("SymbolCatch", null, {
    $documentation: "Symbol naming the exception in catch",
}, AST_SymbolDeclaration);


// represents a naming Label, interesting thing is that there has a 
// references attr, which store all reference to this label
var AST_Label = DEFNODE("Label", "references", {
    $documentation: "Symbol naming a label (declaration)",
    $propdoc: {
        references: "[AST_LabelRef*] a list of nodes referring to this label"
    }
}, AST_Symbol);


/**
 * AST_SymbolRef
 */
var AST_SymbolRef = DEFNODE("SymbolRef", null, {
    $documentation: "Reference to some symbol (not definition/declaration)",
}, AST_Symbol);


/**
 * AST_LabelRef
 */
var AST_LabelRef = DEFNODE("LabelRef", null, {
    $documentation: "Reference to a label symbol",
}, AST_Symbol);


/**
 * AST_This
 */
var AST_This = DEFNODE("This", null, {
    $documentation: "The `this` symbol",
}, AST_Symbol);


/* -----[ AST_Constant ]----- */

/**
 * AST_Constant
 */
var AST_Constant = DEFNODE("Constant", null, {
    $documentation: "Base class for all constants",
    getValue: function () {
        return this.value;
    }
});


/**
 * AST_String
 */
var AST_String = DEFNODE("String", "value", {
    $documentation: "A string literal",
    $propdoc: {
        value: "[string] the contents of this string"
    }
}, AST_Constant);


/**
 * AST_Number
 */
var AST_Number = DEFNODE("Number", "value", {
    $documentation: "A number literal",
    $propdoc: {
        value: "[number] the numeric value"
    }
}, AST_Constant);


/**
 * AST_RegExp
 */
var AST_RegExp = DEFNODE("RegExp", "value", {
    $documentation: "A regexp literal",
    $propdoc: {
        value: "[RegExp] the actual regexp"
    }
}, AST_Constant);


/**
 * AST_Atom
 */
var AST_Atom = DEFNODE("Atom", null, {
    $documentation: "Base class for atoms",
}, AST_Constant);


/**
 * AST_Null
 */
var AST_Null = DEFNODE("Null", null, {
    $documentation: "The `null` atom",
    value: null
}, AST_Atom);


/**
 * AST_NaN
 */
var AST_NaN = DEFNODE("NaN", null, {
    $documentation: "The impossible value",
    value: 0/0
}, AST_Atom);


/**
 * AST_Undefined
 */
var AST_Undefined = DEFNODE("Undefined", null, {
    $documentation: "The `undefined` value",
    value: (function(){}())
}, AST_Atom);


/**
 * AST_Infinity
 */
var AST_Infinity = DEFNODE("Infinity", null, {
    $documentation: "The `Infinity` value",
    value: 1/0
}, AST_Atom);


/**
 * AST_Boolean
 */
var AST_Boolean = DEFNODE("Boolean", null, {
    $documentation: "Base class for booleans",
}, AST_Atom);


/**
 * AST_False
 */
var AST_False = DEFNODE("False", null, {
    $documentation: "The `false` atom",
    value: false
}, AST_Boolean);


/**
 * AST_Constant
 */
var AST_True = DEFNODE("True", null, {
    $documentation: "The `true` atom",
    value: true
}, AST_Boolean);


/* -----[ TreeWalker ]----- */

/**
 * A Class to walk through(analyze) the all nodes on the tree structure.
 *
 * @param {!Function} callback
 * @constructor
 */
function TreeWalker (callback) {
    this.visit = callback;
    // store all nodes have been walked though
    this.stack = [];
};


TreeWalker.prototype = {
    /**
     * Note that all AST_* Class has a walk method
     * and finally it invoke the visitor's _visit function. 
     * But still confuse when to instantiate the visitor 
     * (TreeWalker) instance.
     *
     * descend is a function to traverse the body of AST_Block(most time)
     * or the alternative statements of if, case, for clause.
     *
     * @param {!AST_Node} node
     * @param {Function?} descend
     * @return
     */
    _visit: function (node, descend) {
        // store the node
        this.stack.push(node);
        // call the pass-in callback and transfer the 
        // node and descend function as arguments.
        // But wait.... what kind of the visit function is??
        var ret = this.visit(node, descend ? function () {
            descend.call(node);
        } : noop);
        // why??
        if (!ret && descend) {
            descend.call(node);
        }
        // pop-up node after traversing it.
        this.stack.pop();
        
        return ret;
    },

    /**
     * get parent AST_Node at n position.
     * the last item in stack is itself.
     */
    parent: function (n) {
        return this.stack[this.stack.length - 2 - (n || 0)];
    },

    push: function (node) { 
        this.stack.push(node); 
    },

    pop: function () { 
        return this.stack.pop(); 
    },

    self: function () {
        return this.stack[this.stack.length - 1];
    },
    
    /**
     * retrieve a certain node's parent node 
     * imply with a given type.
     * 
     * @param {!Function} type Class type.
     */
    find_parent: function (type) {
        var stack = this.stack;
        for (var i = stack.length; --i >= 0;) {
            var x = stack[i];
            if (x instanceof type) 
                return x;
        }
    },

    /**
     * Analyze whether current AST_Node is in a environment
     * which requires a boolean result.
     */    
    in_boolean_context: function () {
        var stack = this.stack;
        var i = stack.length, 
            self = stack[--i];
        
        while (i > 0) {
            // previously get the Parent Node.
            var p = stack[--i];
            // those conditions definitely need to return a boolean result.
            // so return true.
            if ((p instanceof AST_If           && p.condition === self) ||
                (p instanceof AST_Conditional  && p.condition === self) ||
                (p instanceof AST_DWLoop       && p.condition === self) ||
                (p instanceof AST_For          && p.condition === self) ||
                (p instanceof AST_UnaryPrefix  && p.operator == "!" && p.expression === self))
            {
                return true;
            }
            // such conditions like (con1 || con2) or (con1 && con2) usually
            // tend to resolve the con1 expression first and then con2, so con1
            // is a no-null value is important.
            if (!(p instanceof AST_Binary && (p.operator == "&&" || p.operator == "||")))
                return false;

            self = p;
        }
    },
    
    /**
     * analyze the loopcontrol's target statment.
     * There are 2 conditions: 
     *   a. there is a label symbolRef in the loop, so the loop will jump out to the label position
     *   b. there is not a label, the loop will continue or end as usual.
     * 
     * @param {!AST_Label} label
     * @return {AST_Node?} 
     */  
    loopcontrol_target: function (label) {
        var stack = this.stack;
        // has label there
        if (label) {
            // search for parent nodes
            for (var i = stack.length; --i >= 0;) {
                var x = stack[i];
                if (x instanceof AST_LabeledStatement && x.label.name == label.name) {
                    return x.body;
                }
            }
        // no label there
        } else {
            for (var i = stack.length; --i >= 0;) {
                var x = stack[i];
                // even though it's a switch, treated as a loop because it can
                // include a AST_Break. Actually, AST_LoopControl only include 
                // AST_Break and AST_Continue;
                if (x instanceof AST_Switch
                    || x instanceof AST_For
                    || x instanceof AST_ForIn
                    || x instanceof AST_DWLoop) return x;
            }
        }
    }
};
