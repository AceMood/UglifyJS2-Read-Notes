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
 * make a array to a object structure
 * and return it
 *
 * @param {!Array} a
 * @return {!Object} ret
 */
function array_to_hash(a) {
    // invoke Object.create with null can create an empty object
    // it's not like `var ret = {};` which can inherit all the properties
    // and methods of Object.prototype. The new object willnot have props
    // and methods at all.
    var ret = Object.create(null);
    for (var i = 0; i < a.length; ++i)
        ret[a[i]] = true;
    return ret;
};


/**
 * slice the given array and produce a new array
 * from the `start` position. Note that the reference
 * of array item will be the same.
 *
 * @param {!Array} a
 * @param {!Number} start
 * @return {!Array}
 */
function slice(a, start) {
    return Array.prototype.slice.call(a, start || 0);
};


/**
 * slice the given string to charactors array.
 *
 * @param {!String} str
 * @return {!Array.<String>}
 */
function characters(str) {
    return str.split("");
};


/**
 * Whether a given object in the given array.
 *
 * @param {!Object} name The given object.
 * @param {!Array} array The given array.
 * @return {!Boolean}
 */
function member(name, array) {
    for (var i = array.length; --i >= 0;)
        if (array[i] == name)
            return true;
    return false;
};


/**
 * execute function on every item of the given array.
 * return the first one that whose return value could 
 * be nonull (i.e false|""|null|undefined|0 will be treated
 * as null value).
 *
 * @param {!Function} func
 * @param {!Array} array
 * @return {!Object}
 */
function find_if(func, array) {
    for (var i = 0, n = array.length; i < n; ++i) {
        if (func(array[i]))
            return array[i];
    }
};


/**
 * repeat a string for multiple times and return it.
 *
 * @param {!String} str
 * @param {!Number} i
 * @return {!String} str * i
 */
function repeat_string(str, i) {
    if (i <= 0) return "";
    if (i == 1) return str;
    
    // use bit operator divide 2 one time.
    // recursely invoke self.
    // bit operator make it faster.
    var d = repeat_string(str, i >> 1);
    
    // add self after devide 2
    d += d;
    
    // if remainder is 1, add original string
    // one more time.
    if (i & 1) d += str;

    return d;
};


/**
 * DefaultsError Class.
 *
 * @param {!String} msg
 * @param {!Object} defs
 * @constructor
 */
function DefaultsError(msg, defs) {
    this.msg = msg;
    this.defs = defs;
};


/**
 * Merge option object. args is the pass-in option collection.
 * defs is the default option collection. croak indicate whether
 * throw exception when they cannot match each other.
 *
 * @param {!Array} args Pass-In arguments.
 * @param {!Object} defs Default option attributes
 * @param {!Boolean} croak
 * @return {!Object}
 */
function defaults(args, defs, croak) {
    // true if use the default options
    // in defs. So set it to an empty object.
    if (args === true)
        args = {};

    // construct default return value.
    var ret = args || {};
    
    // throw exception when property name pass-in not in the defs.
    if (croak) for (var i in ret) if (ret.hasOwnProperty(i) && !defs.hasOwnProperty(i))
        throw new DefaultsError("`" + i + "` is not a supported option", defs);

    // Those properties not pass-in can use the default ones.
    for (var i in defs) if (defs.hasOwnProperty(i)) {
        ret[i] = (args && args.hasOwnProperty(i)) ? args[i] : defs[i];
    }

    return ret;
};


/**
 * Merge two objects. Use the ext's override the obj's.
 *
 * @param {!Object} obj
 * @param {!Object} ext
 * @return {!Object} obj
 */
function merge(obj, ext) {
    for (var i in ext) if (ext.hasOwnProperty(i)) {
        obj[i] = ext[i];
    }
    return obj;
};


/**
 * Define a no-operation function for many default actions.
 * Many Library use this technology.
 *
 * @param {!Array} a
 * @param {!Number} start
 * @return {!Array}
 */
function noop() {};


/**
 * I could not understand what this function do for,
 * to be continued....  // todo
 */
var MAP = (function(){

    /**
     * slice the given array and produce a new array
     * from the `start` position. Note that the reference
     * of array item will be the same.
     *
     * @param {!(Array|Object)} a
     * @param {!Function} f
     * @param {!Boolean} backwards
     * @return {!Array}
     */
    function MAP(a, f, backwards) {
        // initialize two arrays, one named ret for 
        // and another named top for
        var ret = [], top = [], i;
        
        // as a worker go through every item of a.
        // if return true, the loop will be broken.
        function doit() {
            // execute function on a[i];
            var val = f(a[i], i);
            // An instance of Last
            var is_last = val instanceof Last;
            // if Last, get Last's value instead
            if (is_last) val = val.v;
            // An instance of AtTop
            // push the results into top array
            if (val instanceof AtTop) {
                // get AtTop's value instead
                val = val.v;
                // An instance of Splice
                if (val instanceof Splice) {
                    top.push.apply(top, backwards ? val.v.slice().reverse() : val.v);
                } else {
                    top.push(val);
                }
            // else push the results into ret array
            } else if (val !== skip) {
                // An instance of Splice
                if (val instanceof Splice) {
                    ret.push.apply(ret, backwards ? val.v.slice().reverse() : val.v);
                } else {
                    ret.push(val);
                }
            }
            return is_last;
        };

        // a is Array, use Array.isArray could better.
        if (a instanceof Array) {
            if (backwards) {
                for (i = a.length; --i >= 0;) 
                    if (doit()) break;
                // because from end to start iterate the array,
                // now need to reverse its result.
                ret.reverse();
                top.reverse();
            } else {
                for (i = 0; i < a.length; ++i) 
                    if (doit()) break;
            }
        // interate an object
        } else {
            for (i in a) 
                if (a.hasOwnProperty(i)) 
                    if (doit()) break;
        }

        return top.concat(ret);
    };

    // static method to get a new instance of AtTop.
    MAP.at_top = function(val) { return new AtTop(val) };

    // static method to get a new instance of Splice.
    MAP.splice = function(val) { return new Splice(val) };

    // static method to get a new instance of Last.
    MAP.last = function(val) { return new Last(val) };

    /**
     * @type {!Object}
     */
    var skip = MAP.skip = {};


    /**
     * @param {!Object} val
     * @constructor
     */
    function AtTop(val) { this.v = val };
    

    /**
     * @param {!Object} val
     * @constructor
     */
    function Splice(val) { this.v = val };


    /**
     * @param {!Object} val
     * @constructor
     */
    function Last(val) { this.v = val };
    

    return MAP;
    
})();


/**
 * Push an object into a array if it dosen't exists
 * in the array. Use the ES5 array.indexOf to check.
 *
 * @param {!Array} array
 * @param {!Object} el
 */
function push_uniq(array, el) {
    if (array.indexOf(el) < 0)
        array.push(el);
};


/**
 * template in string like {xxxx} could be replaced with
 * object's properties.
 *
 * @param {!String} text
 * @param {!Object} props
 * @return {!String}
 */
function string_template(text, props) {
    // to match the nearest `}` and retrieve the prop name
    // between `{` and `}` using object's corresponding property
    // replace it.
    return text.replace(/\{(.+?)\}/g, function(str, p){
        return props[p];
    });
};


/**
 * Drop the given element in a given array.
 * If the element not in the array, return the
 * array without change.
 *
 * @param {!Array} array
 * @param {!Object} el
 */
function remove(array, el) {
    for (var i = array.length; --i >= 0;) {
        if (array[i] === el) array.splice(i, 1);
    }
};


/**
 * use `binary branch` merge sort to sort an array.
 *
 * @param {!Array} array
 * @param {!Function} cmp Comparison function
 * @return {!Array}
 */
function mergeSort(array, cmp) {
    if (array.length < 2) 
        return array.slice();

    // classical Merge Sort, for more information
    // see here: `http://en.wikipedia.org/wiki/Merge_sort`
    function merge(a, b) {
        var r = [], 
            ai = 0, bi = 0, i = 0;
        while (ai < a.length && bi < b.length) {
            cmp(a[ai], b[bi]) <= 0
                ? r[i++] = a[ai++]
                : r[i++] = b[bi++];
        }
        
        if (ai < a.length) r.push.apply(r, a.slice(ai));
        if (bi < b.length) r.push.apply(r, b.slice(bi));
        return r;
    };

    function _ms(a) {
        if (a.length <= 1)
            return a;
        // why there not use bit operator?
        var m = Math.floor(a.length / 2), 
            left = a.slice(0, m), 
            right = a.slice(m);
        
        left = _ms(left);
        right = _ms(right);
        return merge(left, right);
    };
    
    return _ms(array);
};


/**
 * splice all items in array a but not in array b.
 *
 * @param {!Array} a
 * @param {!Array} b
 * @return {!Array}
 */
function set_difference (a, b) {
    return a.filter(function (el) {
        return b.indexOf(el) < 0;
    });
};


/**
 * splice all items in array a and in array b.
 *
 * @param {!Array} a
 * @param {!Array} b
 * @return {!Array}
 */
function set_intersection (a, b) {
    return a.filter(function(el){
        return b.indexOf(el) >= 0;
    });
};


// this function is taken from Acorn [1], written by Marijn Haverbeke
// [1] https://github.com/marijnh/acorn
/**
 * This is a trick taken from Esprima. It turns out that, on
 * non-Chrome browsers, to check whether a string is in a set, a
 * predicate containing a big ugly `switch` statement is faster than
 * a regular expression, and on Chrome the two are about on par.
 * This function uses `eval` (non-lexical) to produce such a
 * predicate from a space-separated string of words.
 *
 * It starts by sorting the words by length.
 *
 * @param {!(Array|String)} words
 * @return {!Function(this:global):Boolean}
 */
function makePredicate (words) {
    // if words is a string object
    if (!(words instanceof Array)) 
        words = words.split(" ");
    
    var /** type {String} */
        f = "", 
        /** @type {Array.<Array>} */
        cats = [];

    // classify words by their length, for example,
    // cats will contain arrays that all its items word has 
    // the same length, 
    // i.e:
    // cats = [["switch", "break"], ["for", "var"]];
    out: for (var i = 0; i < words.length; ++i) {
        for (var j = 0; j < cats.length; ++j)
            if (cats[j][0].length == words[i].length) {
                cats[j].push(words[i]);
                continue out;
            }
        cats.push([words[i]]);
    }

    /**
     * such code generate the function's body to check whether str is in
     * the given arr.
     *
     * @param {!Array.<String>} arr
     */
    function compareTo (arr) {
        if (arr.length == 1) 
            return f += "return str === " + JSON.stringify(arr[0]) + ";";
        f += "switch(str){";
        for (var i = 0; i < arr.length; ++i) 
            f += "case " + JSON.stringify(arr[i]) + ":";
        f += "return true}return false;";
    }

    // When there are more than three length categories, an outer
    // switch first dispatches on the lengths, to save on comparisons.
    if (cats.length > 3) {
        // sort the arrays in cats order by theirs length
        // more items more ahead.
        // notes: every comparison will genrate a new array,
        // so it may not have a good performance.
        cats.sort(function(a, b) {return b.length - a.length;});
        
        f += "switch(str.length){";
        for (var i = 0; i < cats.length; ++i) {
            var cat = cats[i];
            f += "case " + cat[0].length + ":";
            compareTo(cat);
        }
        f += "}";
    // Otherwise, simply generate a flat `switch` statement.
    } else {
        compareTo(words);
    }

    return new Function("str", f);
};


/**
 * represent a dictionary Class.
 *
 * @constructor
 */
function Dictionary() {
    this._values = Object.create(null);
    this._size = 0;
};


// method for dictionary
Dictionary.prototype = {
    set: function (key, val) {
        if (!this.has(key)) ++this._size;
        this._values["$" + key] = val;
        return this;
    },
    get: function(key) { return this._values["$" + key] },
    del: function(key) {
        if (this.has(key)) {
            --this._size;
            delete this._values["$" + key];
        }
        return this;
    },
    has: function(key) { return ("$" + key) in this._values },
    /**
     * @param {!Function.<Object,String>} f As a iterator function 
     */
    each: function(f) {
        for (var i in this._values)
            f(this._values[i], i.substr(1));
    },
    size: function() {
        return this._size;
    },
    /**
     * @param {!Function.<Object,String>} f As a iterator function 
     * @return {!Array}
     */
    map: function(f) {
        var ret = [];
        for (var i in this._values)
            ret.push(f(this._values[i], i.substr(1)));
        return ret;
    }
};
