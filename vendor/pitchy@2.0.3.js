(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.pitchy = {}));
}(this, (function (exports) { 'use strict';

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
  }

  function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return _arrayLikeToArray(arr);
  }

  function _iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
  }

  function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
  }

  function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;

    for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

    return arr2;
  }

  function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  function FFT(size) {
    this.size = size | 0;
    if (this.size <= 1 || (this.size & (this.size - 1)) !== 0)
      throw new Error('FFT size must be a power of two and bigger than 1');

    this._csize = size << 1;

    // NOTE: Use of `var` is intentional for old V8 versions
    var table = new Array(this.size * 2);
    for (var i = 0; i < table.length; i += 2) {
      const angle = Math.PI * i / this.size;
      table[i] = Math.cos(angle);
      table[i + 1] = -Math.sin(angle);
    }
    this.table = table;

    // Find size's power of two
    var power = 0;
    for (var t = 1; this.size > t; t <<= 1)
      power++;

    // Calculate initial step's width:
    //   * If we are full radix-4 - it is 2x smaller to give inital len=8
    //   * Otherwise it is the same as `power` to give len=4
    this._width = power % 2 === 0 ? power - 1 : power;

    // Pre-compute bit-reversal patterns
    this._bitrev = new Array(1 << this._width);
    for (var j = 0; j < this._bitrev.length; j++) {
      this._bitrev[j] = 0;
      for (var shift = 0; shift < this._width; shift += 2) {
        var revShift = this._width - shift - 2;
        this._bitrev[j] |= ((j >>> shift) & 3) << revShift;
      }
    }

    this._out = null;
    this._data = null;
    this._inv = 0;
  }
  var fft = FFT;

  FFT.prototype.fromComplexArray = function fromComplexArray(complex, storage) {
    var res = storage || new Array(complex.length >>> 1);
    for (var i = 0; i < complex.length; i += 2)
      res[i >>> 1] = complex[i];
    return res;
  };

  FFT.prototype.createComplexArray = function createComplexArray() {
    const res = new Array(this._csize);
    for (var i = 0; i < res.length; i++)
      res[i] = 0;
    return res;
  };

  FFT.prototype.toComplexArray = function toComplexArray(input, storage) {
    var res = storage || this.createComplexArray();
    for (var i = 0; i < res.length; i += 2) {
      res[i] = input[i >>> 1];
      res[i + 1] = 0;
    }
    return res;
  };

  FFT.prototype.completeSpectrum = function completeSpectrum(spectrum) {
    var size = this._csize;
    var half = size >>> 1;
    for (var i = 2; i < half; i += 2) {
      spectrum[size - i] = spectrum[i];
      spectrum[size - i + 1] = -spectrum[i + 1];
    }
  };

  FFT.prototype.transform = function transform(out, data) {
    if (out === data)
      throw new Error('Input and output buffers must be different');

    this._out = out;
    this._data = data;
    this._inv = 0;
    this._transform4();
    this._out = null;
    this._data = null;
  };

  FFT.prototype.realTransform = function realTransform(out, data) {
    if (out === data)
      throw new Error('Input and output buffers must be different');

    this._out = out;
    this._data = data;
    this._inv = 0;
    this._realTransform4();
    this._out = null;
    this._data = null;
  };

  FFT.prototype.inverseTransform = function inverseTransform(out, data) {
    if (out === data)
      throw new Error('Input and output buffers must be different');

    this._out = out;
    this._data = data;
    this._inv = 1;
    this._transform4();
    for (var i = 0; i < out.length; i++)
      out[i] /= this.size;
    this._out = null;
    this._data = null;
  };

  // radix-4 implementation
  //
  // NOTE: Uses of `var` are intentional for older V8 version that do not
  // support both `let compound assignments` and `const phi`
  FFT.prototype._transform4 = function _transform4() {
    var out = this._out;
    var size = this._csize;

    // Initial step (permute and transform)
    var width = this._width;
    var step = 1 << width;
    var len = (size / step) << 1;

    var outOff;
    var t;
    var bitrev = this._bitrev;
    if (len === 4) {
      for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
        const off = bitrev[t];
        this._singleTransform2(outOff, off, step);
      }
    } else {
      // len === 8
      for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
        const off = bitrev[t];
        this._singleTransform4(outOff, off, step);
      }
    }

    // Loop through steps in decreasing order
    var inv = this._inv ? -1 : 1;
    var table = this.table;
    for (step >>= 2; step >= 2; step >>= 2) {
      len = (size / step) << 1;
      var quarterLen = len >>> 2;

      // Loop through offsets in the data
      for (outOff = 0; outOff < size; outOff += len) {
        // Full case
        var limit = outOff + quarterLen;
        for (var i = outOff, k = 0; i < limit; i += 2, k += step) {
          const A = i;
          const B = A + quarterLen;
          const C = B + quarterLen;
          const D = C + quarterLen;

          // Original values
          const Ar = out[A];
          const Ai = out[A + 1];
          const Br = out[B];
          const Bi = out[B + 1];
          const Cr = out[C];
          const Ci = out[C + 1];
          const Dr = out[D];
          const Di = out[D + 1];

          // Middle values
          const MAr = Ar;
          const MAi = Ai;

          const tableBr = table[k];
          const tableBi = inv * table[k + 1];
          const MBr = Br * tableBr - Bi * tableBi;
          const MBi = Br * tableBi + Bi * tableBr;

          const tableCr = table[2 * k];
          const tableCi = inv * table[2 * k + 1];
          const MCr = Cr * tableCr - Ci * tableCi;
          const MCi = Cr * tableCi + Ci * tableCr;

          const tableDr = table[3 * k];
          const tableDi = inv * table[3 * k + 1];
          const MDr = Dr * tableDr - Di * tableDi;
          const MDi = Dr * tableDi + Di * tableDr;

          // Pre-Final values
          const T0r = MAr + MCr;
          const T0i = MAi + MCi;
          const T1r = MAr - MCr;
          const T1i = MAi - MCi;
          const T2r = MBr + MDr;
          const T2i = MBi + MDi;
          const T3r = inv * (MBr - MDr);
          const T3i = inv * (MBi - MDi);

          // Final values
          const FAr = T0r + T2r;
          const FAi = T0i + T2i;

          const FCr = T0r - T2r;
          const FCi = T0i - T2i;

          const FBr = T1r + T3i;
          const FBi = T1i - T3r;

          const FDr = T1r - T3i;
          const FDi = T1i + T3r;

          out[A] = FAr;
          out[A + 1] = FAi;
          out[B] = FBr;
          out[B + 1] = FBi;
          out[C] = FCr;
          out[C + 1] = FCi;
          out[D] = FDr;
          out[D + 1] = FDi;
        }
      }
    }
  };

  // radix-2 implementation
  //
  // NOTE: Only called for len=4
  FFT.prototype._singleTransform2 = function _singleTransform2(outOff, off,
                                                               step) {
    const out = this._out;
    const data = this._data;

    const evenR = data[off];
    const evenI = data[off + 1];
    const oddR = data[off + step];
    const oddI = data[off + step + 1];

    const leftR = evenR + oddR;
    const leftI = evenI + oddI;
    const rightR = evenR - oddR;
    const rightI = evenI - oddI;

    out[outOff] = leftR;
    out[outOff + 1] = leftI;
    out[outOff + 2] = rightR;
    out[outOff + 3] = rightI;
  };

  // radix-4
  //
  // NOTE: Only called for len=8
  FFT.prototype._singleTransform4 = function _singleTransform4(outOff, off,
                                                               step) {
    const out = this._out;
    const data = this._data;
    const inv = this._inv ? -1 : 1;
    const step2 = step * 2;
    const step3 = step * 3;

    // Original values
    const Ar = data[off];
    const Ai = data[off + 1];
    const Br = data[off + step];
    const Bi = data[off + step + 1];
    const Cr = data[off + step2];
    const Ci = data[off + step2 + 1];
    const Dr = data[off + step3];
    const Di = data[off + step3 + 1];

    // Pre-Final values
    const T0r = Ar + Cr;
    const T0i = Ai + Ci;
    const T1r = Ar - Cr;
    const T1i = Ai - Ci;
    const T2r = Br + Dr;
    const T2i = Bi + Di;
    const T3r = inv * (Br - Dr);
    const T3i = inv * (Bi - Di);

    // Final values
    const FAr = T0r + T2r;
    const FAi = T0i + T2i;

    const FBr = T1r + T3i;
    const FBi = T1i - T3r;

    const FCr = T0r - T2r;
    const FCi = T0i - T2i;

    const FDr = T1r - T3i;
    const FDi = T1i + T3r;

    out[outOff] = FAr;
    out[outOff + 1] = FAi;
    out[outOff + 2] = FBr;
    out[outOff + 3] = FBi;
    out[outOff + 4] = FCr;
    out[outOff + 5] = FCi;
    out[outOff + 6] = FDr;
    out[outOff + 7] = FDi;
  };

  // Real input radix-4 implementation
  FFT.prototype._realTransform4 = function _realTransform4() {
    var out = this._out;
    var size = this._csize;

    // Initial step (permute and transform)
    var width = this._width;
    var step = 1 << width;
    var len = (size / step) << 1;

    var outOff;
    var t;
    var bitrev = this._bitrev;
    if (len === 4) {
      for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
        const off = bitrev[t];
        this._singleRealTransform2(outOff, off >>> 1, step >>> 1);
      }
    } else {
      // len === 8
      for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
        const off = bitrev[t];
        this._singleRealTransform4(outOff, off >>> 1, step >>> 1);
      }
    }

    // Loop through steps in decreasing order
    var inv = this._inv ? -1 : 1;
    var table = this.table;
    for (step >>= 2; step >= 2; step >>= 2) {
      len = (size / step) << 1;
      var halfLen = len >>> 1;
      var quarterLen = halfLen >>> 1;
      var hquarterLen = quarterLen >>> 1;

      // Loop through offsets in the data
      for (outOff = 0; outOff < size; outOff += len) {
        for (var i = 0, k = 0; i <= hquarterLen; i += 2, k += step) {
          var A = outOff + i;
          var B = A + quarterLen;
          var C = B + quarterLen;
          var D = C + quarterLen;

          // Original values
          var Ar = out[A];
          var Ai = out[A + 1];
          var Br = out[B];
          var Bi = out[B + 1];
          var Cr = out[C];
          var Ci = out[C + 1];
          var Dr = out[D];
          var Di = out[D + 1];

          // Middle values
          var MAr = Ar;
          var MAi = Ai;

          var tableBr = table[k];
          var tableBi = inv * table[k + 1];
          var MBr = Br * tableBr - Bi * tableBi;
          var MBi = Br * tableBi + Bi * tableBr;

          var tableCr = table[2 * k];
          var tableCi = inv * table[2 * k + 1];
          var MCr = Cr * tableCr - Ci * tableCi;
          var MCi = Cr * tableCi + Ci * tableCr;

          var tableDr = table[3 * k];
          var tableDi = inv * table[3 * k + 1];
          var MDr = Dr * tableDr - Di * tableDi;
          var MDi = Dr * tableDi + Di * tableDr;

          // Pre-Final values
          var T0r = MAr + MCr;
          var T0i = MAi + MCi;
          var T1r = MAr - MCr;
          var T1i = MAi - MCi;
          var T2r = MBr + MDr;
          var T2i = MBi + MDi;
          var T3r = inv * (MBr - MDr);
          var T3i = inv * (MBi - MDi);

          // Final values
          var FAr = T0r + T2r;
          var FAi = T0i + T2i;

          var FBr = T1r + T3i;
          var FBi = T1i - T3r;

          out[A] = FAr;
          out[A + 1] = FAi;
          out[B] = FBr;
          out[B + 1] = FBi;

          // Output final middle point
          if (i === 0) {
            var FCr = T0r - T2r;
            var FCi = T0i - T2i;
            out[C] = FCr;
            out[C + 1] = FCi;
            continue;
          }

          // Do not overwrite ourselves
          if (i === hquarterLen)
            continue;

          // In the flipped case:
          // MAi = -MAi
          // MBr=-MBi, MBi=-MBr
          // MCr=-MCr
          // MDr=MDi, MDi=MDr
          var ST0r = T1r;
          var ST0i = -T1i;
          var ST1r = T0r;
          var ST1i = -T0i;
          var ST2r = -inv * T3i;
          var ST2i = -inv * T3r;
          var ST3r = -inv * T2i;
          var ST3i = -inv * T2r;

          var SFAr = ST0r + ST2r;
          var SFAi = ST0i + ST2i;

          var SFBr = ST1r + ST3i;
          var SFBi = ST1i - ST3r;

          var SA = outOff + quarterLen - i;
          var SB = outOff + halfLen - i;

          out[SA] = SFAr;
          out[SA + 1] = SFAi;
          out[SB] = SFBr;
          out[SB + 1] = SFBi;
        }
      }
    }
  };

  // radix-2 implementation
  //
  // NOTE: Only called for len=4
  FFT.prototype._singleRealTransform2 = function _singleRealTransform2(outOff,
                                                                       off,
                                                                       step) {
    const out = this._out;
    const data = this._data;

    const evenR = data[off];
    const oddR = data[off + step];

    const leftR = evenR + oddR;
    const rightR = evenR - oddR;

    out[outOff] = leftR;
    out[outOff + 1] = 0;
    out[outOff + 2] = rightR;
    out[outOff + 3] = 0;
  };

  // radix-4
  //
  // NOTE: Only called for len=8
  FFT.prototype._singleRealTransform4 = function _singleRealTransform4(outOff,
                                                                       off,
                                                                       step) {
    const out = this._out;
    const data = this._data;
    const inv = this._inv ? -1 : 1;
    const step2 = step * 2;
    const step3 = step * 3;

    // Original values
    const Ar = data[off];
    const Br = data[off + step];
    const Cr = data[off + step2];
    const Dr = data[off + step3];

    // Pre-Final values
    const T0r = Ar + Cr;
    const T1r = Ar - Cr;
    const T2r = Br + Dr;
    const T3r = inv * (Br - Dr);

    // Final values
    const FAr = T0r + T2r;

    const FBr = T1r;
    const FBi = -T3r;

    const FCr = T0r - T2r;

    const FDr = T1r;
    const FDi = T3r;

    out[outOff] = FAr;
    out[outOff + 1] = 0;
    out[outOff + 2] = FBr;
    out[outOff + 3] = FBi;
    out[outOff + 4] = FCr;
    out[outOff + 5] = 0;
    out[outOff + 6] = FDr;
    out[outOff + 7] = FDi;
  };

  var np2 = function(v) {
    v += v === 0;
    --v;
    v |= v >>> 1;
    v |= v >>> 2;
    v |= v >>> 4;
    v |= v >>> 8;
    v |= v >>> 16;
    return v + 1
  };

  /**
   * A class that can perform autocorrelation on input arrays of a given size.
   *
   * The class holds internal buffers so that no additional allocations are
   * necessary while performing the operation.
   *
   * @typeParam T - the buffer type to use. While inputs to the autocorrelation
   * process can be any array-like type, the output buffer (whether provided
   * explicitly or using a fresh buffer) is always of this type.
   */
  var Autocorrelator = /*#__PURE__*/function () {
    _createClass(Autocorrelator, null, [{
      key: "forFloat32Array",

      /**
       * A helper method to create an {@link Autocorrelator} using {@link Float32Array} buffers.
       *
       * @param inputLength - the input array length to support
       */
      value: function forFloat32Array(inputLength) {
        return new Autocorrelator(inputLength, function (length) {
          return new Float32Array(length);
        });
      }
      /**
       * A helper method to create an {@link Autocorrelator} using {@link Float64Array} buffers.
       *
       * @param inputLength - the input array length to support
       */

    }, {
      key: "forFloat64Array",
      value: function forFloat64Array(inputLength) {
        return new Autocorrelator(inputLength, function (length) {
          return new Float64Array(length);
        });
      }
      /**
       * A helper method to create an {@link Autocorrelator} using `number[]` buffers.
       *
       * @param inputLength - the input array length to support
       */

    }, {
      key: "forNumberArray",
      value: function forNumberArray(inputLength) {
        return new Autocorrelator(inputLength, function (length) {
          return Array(length);
        });
      }
      /**
       * Constructs a new {@link Autocorrelator} able to handle input arrays of the
       * given length.
       *
       * @param inputLength - the input array length to support. This `Autocorrelator`
       * will only support operation on arrays of this length.
       * @param bufferSupplier - the function to use for creating buffers, accepting
       * the length of the buffer to create and returning a new buffer of that
       * length. The values of the returned buffer need not be initialized in any
       * particular way.
       */

    }]);

    function Autocorrelator(inputLength, bufferSupplier) {
      _classCallCheck(this, Autocorrelator);

      _defineProperty(this, "_inputLength", void 0);

      _defineProperty(this, "_fft", void 0);

      _defineProperty(this, "_bufferSupplier", void 0);

      _defineProperty(this, "_paddedInputBuffer", void 0);

      _defineProperty(this, "_transformBuffer", void 0);

      _defineProperty(this, "_inverseBuffer", void 0);

      if (inputLength < 1) {
        throw new Error("Input length must be at least one");
      }

      this._inputLength = inputLength; // We need to double the input length to get correct results, and the FFT
      // algorithm we use requires a length that's a power of 2

      this._fft = new fft(np2(2 * inputLength));
      this._bufferSupplier = bufferSupplier;
      this._paddedInputBuffer = this._bufferSupplier(this._fft.size);
      this._transformBuffer = this._bufferSupplier(2 * this._fft.size);
      this._inverseBuffer = this._bufferSupplier(2 * this._fft.size);
    }
    /**
     * Returns the supported input length.
     *
     * @returns the supported input length
     */


    _createClass(Autocorrelator, [{
      key: "autocorrelate",

      /**
       * Autocorrelates the given input data.
       *
       * @param input - the input data to autocorrelate
       * @param output - the output buffer into which to write the autocorrelated
       * data. If not provided, a new buffer will be created.
       * @returns `output`
       */
      value: function autocorrelate(input) {
        var output = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this._bufferSupplier(input.length);

        if (input.length !== this._inputLength) {
          throw new Error("Input must have length ".concat(this._inputLength, " but had length ").concat(input.length));
        } // Step 0: pad the input array with zeros


        for (var i = 0; i < input.length; i++) {
          this._paddedInputBuffer[i] = input[i];
        }

        for (var _i = input.length; _i < this._paddedInputBuffer.length; _i++) {
          this._paddedInputBuffer[_i] = 0;
        } // Step 1: get the DFT of the input array


        this._fft.realTransform(this._transformBuffer, this._paddedInputBuffer); // We need to fill in the right half of the array too


        this._fft.completeSpectrum(this._transformBuffer); // Step 2: multiply each entry by its conjugate


        var tb = this._transformBuffer;

        for (var _i2 = 0; _i2 < tb.length; _i2 += 2) {
          tb[_i2] = tb[_i2] * tb[_i2] + tb[_i2 + 1] * tb[_i2 + 1];
          tb[_i2 + 1] = 0;
        } // Step 3: perform the inverse transform


        this._fft.inverseTransform(this._inverseBuffer, this._transformBuffer); // This last result (the inverse transform) contains the autocorrelation
        // data, which is completely real


        for (var _i3 = 0; _i3 < input.length; _i3++) {
          output[_i3] = this._inverseBuffer[2 * _i3];
        }

        return output;
      }
    }, {
      key: "inputLength",
      get: function get() {
        return this._inputLength;
      }
    }]);

    return Autocorrelator;
  }();
  /**
   * Returns an array of all the key maximum positions in the given input array.
   *
   * In McLeod's paper, a key maximum is the highest maximum between a positively
   * sloped zero crossing and a negatively sloped one.
   *
   * TODO: the paper by McLeod proposes doing parabolic interpolation to get more
   * accurate key maxima; right now this implementation doesn't do that, but it
   * could be implemented later.
   *
   * TODO: it may be more efficient not to construct a new output array each time,
   * but that would also make the code more complicated (more so than the changes
   * that were needed to remove the other allocations).
   */

  function getKeyMaximumIndices(input) {
    // The indices of the key maxima
    var keyIndices = []; // Whether the last zero crossing found was positively sloped; equivalently,
    // whether we're looking for a key maximum

    var lookingForMaximum = false; // The largest local maximum found so far

    var max = -Infinity; // The index of the largest local maximum so far

    var maxIndex = -1;

    for (var i = 1; i < input.length; i++) {
      if (input[i - 1] <= 0 && input[i] > 0) {
        // Positively sloped zero crossing
        lookingForMaximum = true;
        maxIndex = i;
        max = input[i];
      } else if (input[i - 1] > 0 && input[i] <= 0) {
        // Negatively sloped zero crossing
        lookingForMaximum = false;

        if (maxIndex !== -1) {
          keyIndices.push(maxIndex);
        }
      } else if (lookingForMaximum && input[i] > max) {
        max = input[i];
        maxIndex = i;
      }
    }

    return keyIndices;
  }
  /**
   * A class that can detect the pitch of a note from a time-domain input array.
   *
   * This class uses the McLeod pitch method (MPM) to detect pitches. MPM is
   * described in the paper 'A Smarter Way to Find Pitch' by Philip McLeod and
   * Geoff Wyvill
   * (http://miracle.otago.ac.nz/tartini/papers/A_Smarter_Way_to_Find_Pitch.pdf).
   *
   * The class holds internal buffers so that a minimal number of additional
   * allocations are necessary while performing the operation.
   *
   * @typeParam T - the buffer type to use internally. Inputs to the
   * pitch-detection process can be any numeric array type.
   */


  var PitchDetector = /*#__PURE__*/function () {
    _createClass(PitchDetector, null, [{
      key: "forFloat32Array",
      // TODO: it might be nice if this were configurable

      /**
       * A helper method to create an {@link PitchDetector} using {@link Float32Array} buffers.
       *
       * @param inputLength - the input array length to support
       */
      value: function forFloat32Array(inputLength) {
        return new PitchDetector(inputLength, function (length) {
          return new Float32Array(length);
        });
      }
      /**
       * A helper method to create an {@link PitchDetector} using {@link Float64Array} buffers.
       *
       * @param inputLength - the input array length to support
       */

    }, {
      key: "forFloat64Array",
      value: function forFloat64Array(inputLength) {
        return new PitchDetector(inputLength, function (length) {
          return new Float64Array(length);
        });
      }
      /**
       * A helper method to create an {@link PitchDetector} using `number[]` buffers.
       *
       * @param inputLength - the input array length to support
       */

    }, {
      key: "forNumberArray",
      value: function forNumberArray(inputLength) {
        return new PitchDetector(inputLength, function (length) {
          return Array(length);
        });
      }
      /**
       * Constructs a new {@link PitchDetector} able to handle input arrays of the
       * given length.
       *
       * @param inputLength - the input array length to support. This
       * `PitchDetector` will only support operation on arrays of this length.
       * @param bufferSupplier - the function to use for creating buffers, accepting
       * the length of the buffer to create and returning a new buffer of that
       * length. The values of the returned buffer need not be initialized in any
       * particular way.
       */

    }]);

    function PitchDetector(inputLength, bufferSupplier) {
      _classCallCheck(this, PitchDetector);

      _defineProperty(this, "_autocorrelator", void 0);

      _defineProperty(this, "_nsdfBuffer", void 0);

      _defineProperty(this, "_clarityThreshold", 0.9);

      this._autocorrelator = new Autocorrelator(inputLength, bufferSupplier);
      this._nsdfBuffer = bufferSupplier(inputLength);
    }
    /**
     * Returns the supported input length.
     *
     * @returns the supported input length
     */


    _createClass(PitchDetector, [{
      key: "findPitch",

      /**
       * Returns the pitch detected using McLeod Pitch Method (MPM) along with a
       * measure of its clarity.
       *
       * The clarity is a value between 0 and 1 (potentially inclusive) that
       * represents how "clear" the pitch was. A clarity value of 1 indicates that
       * the pitch was very distinct, while lower clarity values indicate less
       * definite pitches.
       *
       * @param input - the time-domain input data
       * @param sampleRate - the sample rate at which the input data was collected
       * @returns the detected pitch, in Hz, followed by the clarity
       */
      value: function findPitch(input, sampleRate) {
        var _this = this;

        this._nsdf(input);

        var keyMaximumIndices = getKeyMaximumIndices(this._nsdfBuffer);

        if (keyMaximumIndices.length === 0) {
          // No key maxima means that we either don't have enough data to analyze or
          // that the data was flawed (such as an input array of zeroes)
          return [0, 0];
        } // The highest key maximum


        var nMax = Math.max.apply(Math, _toConsumableArray(keyMaximumIndices.map(function (i) {
          return _this._nsdfBuffer[i];
        }))); // Following the paper, we return the pitch corresponding to the first key
        // maximum higher than K * nMax. This is guaranteed not to be undefined, since
        // we know of at least one key maximum satisfying this condition (whichever
        // key maximum gave us nMax).
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion

        var resultIndex = keyMaximumIndices.find(function (i) {
          return _this._nsdfBuffer[i] >= _this._clarityThreshold * nMax;
        }); // Due to floating point errors, the clarity may occasionally come out to be
        // slightly over 1.0. We can avoid incorrect results by clamping the value.

        var clarity = Math.min(this._nsdfBuffer[resultIndex], 1.0);
        return [sampleRate / resultIndex, clarity];
      }
      /**
       * Computes the NSDF of the input and stores it in the internal buffer. This
       * is equation (9) in the McLeod pitch method paper.
       */

    }, {
      key: "_nsdf",
      value: function _nsdf(input) {
        // The function r'(tau) is the autocorrelation
        this._autocorrelator.autocorrelate(input, this._nsdfBuffer); // The function m'(tau) (defined in equation (6)) can be computed starting
        // with m'(0), which is equal to 2r'(0), and then iteratively modified to
        // get m'(1), m'(2), etc. For example, to get m'(1), we take m'(0) and
        // subtract x_0^2 and x_{W-1}^2. Then, to get m'(2), we take m'(1) and
        // subtract x_1^2 and x_{W-2}^2, and further values are similar (see the
        // note at the end of section 6 in the MPM paper).
        //
        // The resulting array values are 2 * r'(tau) / m'(tau). We use m below as
        // the incremental value of m'.


        var m = 2 * this._nsdfBuffer[0];
        var i; // As pointed out by issuefiler on GitHub, we can take advantage of the fact
        // that m will never increase to avoid division by zero by ending this loop
        // once m === 0. The rest of the array values after m becomes 0 will just be
        // set to 0 themselves. We actually check for m > 0 rather than m === 0
        // because there may be small floating-point errors that cause m to become
        // negative rather than exactly 0.

        for (i = 0; i < this._nsdfBuffer.length && m > 0; i++) {
          this._nsdfBuffer[i] = 2 * this._nsdfBuffer[i] / m;
          m -= Math.pow(input[i], 2) + Math.pow(input[input.length - i - 1], 2);
        } // If there are any array values remaining, it means m === 0 for those
        // values of tau, so we can just set them to 0


        for (; i < this._nsdfBuffer.length; i++) {
          this._nsdfBuffer[i] = 0;
        }
      }
    }, {
      key: "inputLength",
      get: function get() {
        return this._autocorrelator.inputLength;
      }
    }]);

    return PitchDetector;
  }();

  exports.Autocorrelator = Autocorrelator;
  exports.PitchDetector = PitchDetector;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
