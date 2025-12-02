window.initAlgorithms = () => {
	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Algorithms                                                                                           |
	// +---------------------------------------------------------------------------------------------------------------+

	const blz = (window.blz = (indat) => {
		const composite = indat.getUint32(indat.byteLength - 8, true);
		const offset = composite >> 24;
		const compressedLength = composite & 0xffffff; // could be zero
		const additionalLength = indat.getUint32(indat.byteLength - 4, true);

		if (compressedLength > indat.byteLength || additionalLength > 1e6) {
			throw new Error('data is probably not compressed');
		}

		const outbuf = new Uint8Array(indat.byteLength + additionalLength);
		const inbuf = bufToU8(indat);
		let outoff = outbuf.byteLength;
		let inoff = inbuf.byteLength - offset;

		while (inoff > inbuf.byteLength - compressedLength) {
			const control = inbuf[--inoff];
			for (let bit = 0x80; bit && inoff > inbuf.byteLength - compressedLength; bit >>= 1) {
				if (control & bit) {
					// back-reference
					const composite = (inbuf[--inoff] << 8) | inbuf[--inoff];
					const offset = (composite & 0xfff) + 3;
					const length = (composite >> 12) + 3;
					for (let i = 0; i < length; ++i) outbuf[--outoff] = outbuf[outoff + offset];
				} else {
					// literal
					outbuf[--outoff] = inbuf[--inoff];
				}
			}
		}

		outbuf.set(inbuf.slice(0, inbuf.byteLength - compressedLength)); // copy decompressed part
		return new DataView(outbuf.buffer);
	});

	// compresses overlay files MOSTLY EXACTLY (i.e. blzCompress(blz(overlay)) == overlay for NEARLY ALL overlays)
	// these overlays: NA 2, EU 2, KO 2, KO 123, KO 139 don't recompress exactly, there is likely some other
	// scoring system that i haven't been able to reverse engineer
	// `minimumSize` is useful for modding overlays without having to change the FAT or overlay tables or anything else
	const blzCompress = (window.blzCompress = (indat, minimumSize) => {
		const rightPadding = minimumSize === undefined ? 12 : 256;
		const inbuf = bufToU8(indat);
		// in the worst case, blz compression results in 9/8 (112.5%) of the original input size
		// (the size of literals and control bytes)
		// round up to 4-byte boundaries, then add 8 bytes of header (so, may add up to 12 bytes)
		const outbuf = new Uint8Array(Math.ceil((inbuf.length * 9) / 8) + rightPadding);

		const startingOutoff = outbuf.length - rightPadding;
		let outoff = startingOutoff;
		let inoff = inbuf.length - 1;

		const stops = [];
		let controlByteOffset;
		let bestNetSaves = 0;
		let netSaves = 0;

		const offsets = new Array(256);
		for (let i = 0; i < 256; ++i) offsets[i] = [];

		while (inoff >= 0) {
			--netSaves;
			controlByteOffset = --outoff;

			for (let i = 7; i >= 0 && inoff >= 0; --i) {
				const byte = inbuf[inoff];

				// find an offset between [inoff + 2, inbuf.byteLength - 3]
				// such that:
				// inbuf[inoff] == inbuf[inoff + offset]
				// inbuf[inoff - 1] == inbuf[inoff + offset - 1]
				// inbuf[inoff - 2] == inbuf[inoff + offset - 2]
				// ...
				let bestBackReference, bestBackReferenceOffset;
				for (
					let offsetIndex = offsets[byte].length - 1,
						inoffsetted = offsets[byte][offsetIndex],
						offset = (inoffsetted ?? 0) - inoff;
					offsetIndex >= 0 && offset < 4099;
					inoffsetted = offsets[byte][--offsetIndex], offset = (inoffsetted ?? 0) - inoff
				) {
					if (offset < 3) continue;
					/* for ( // this loop statement is functionally identical to the one above, but **much** slower
					let offset = 3, inoffsetted = inoff + offset;
					offset < 4099 && inoffsetted < inbuf.byteLength;
					++offset, ++inoffsetted
				) { */
					let length = 1;
					for (; length < 18 && length < offset && inoff - length >= 0; ++length) {
						if (inbuf[inoff - length] !== inbuf[inoffsetted - length]) break;
					}

					if (length >= 3 && (!bestBackReference || length > bestBackReference)) {
						// back-reference found; prefer smallest possible offset
						bestBackReference = length;
						bestBackReferenceOffset = offset;
					}
				}

				if (bestBackReference) {
					outbuf[controlByteOffset] |= 1 << i;
					const composite = (bestBackReferenceOffset - 3) | ((bestBackReference - 3) << 12);
					outbuf[--outoff] = composite >> 8;
					outbuf[--outoff] = composite & 0xff;

					let usable = false; // unusable stops still need to be checked for decompression overwrites
					if ((netSaves += bestBackReference - 2) > bestNetSaves) {
						usable = true;
						bestNetSaves = netSaves;
					}
					stops.push({ inoffStart: inoff, inoffEnd: inoff - bestBackReference, outoff, usable });

					for (let i = 0; i < bestBackReference; ++i, --inoff) offsets[inbuf[inoff]].push(inoff);
				} else {
					outbuf[--outoff] = byte;
					offsets[byte].push(inoff);
					--inoff;
				}
			}
		}

		// if there are just a few more literals remaining, just include them all in compression
		if (netSaves === bestNetSaves) stops.push({ inoffStart: inoff + 1, inoffEnd: inoff, outoff, usable: true });

		const outdat = bufToDat(outbuf);

		let instop = inoff;
		let outstop = outoff;

		cutoff: for (let i = stops.length - 1; i >= 0; --i) {
			// assume we take this stop
			if (!stops[i].usable) continue;
			const hypoDecompressedLength = stops[i].inoffEnd + 1;
			const hypoDataStart = stops[i].outoff - hypoDecompressedLength;

			for (let j = i; j >= 0; --j) {
				const decompHypoInoff = stops[j].outoff - hypoDataStart;
				const decompHypoOutoff = stops[j].inoffStart;
				// make sure not overwriting compression stream
				if (decompHypoOutoff < decompHypoInoff) continue cutoff;
			}

			if (minimumSize !== undefined) {
				const hypoNextDecompLength = stops[i].inoffEnd + 1;
				const hypoNextCompLength = startingOutoff - stops[i].outoff;
				const estimatedSize = Math.ceil((hypoNextDecompLength + hypoNextCompLength) / 4) * 4 + 8;
				if (estimatedSize <= minimumSize) {
					instop = stops[i].inoffEnd;
					outstop = stops[i].outoff;
					continue;
				}
			} else {
				// this stop is fine
				instop = stops[i].inoffEnd;
				outstop = stops[i].outoff;
			}
			break;
		}

		const decompressedLength = instop + 1;
		const dataStart = outstop - decompressedLength;
		outbuf.set(inbuf.slice(0, decompressedLength), dataStart);

		const compressedLength = startingOutoff - outstop;
		const paddingStart = startingOutoff;
		let headerStart = dataStart + Math.ceil((decompressedLength + compressedLength) / 4) * 4;
		if (minimumSize !== undefined) {
			const estimatedSize = headerStart - dataStart + 8;
			headerStart += minimumSize - estimatedSize;
		}
		const dataLength = headerStart + 8 - dataStart;
		const additionalLength = inbuf.length - dataLength;
		if (additionalLength <= 0) {
			// if compression results in a larger size, then store decompressed and with a zero'd header
			// this does mean on some custom input (e.g. [1,2,3,...,20]), blz(blzCompress(x)) == x will not hold
			// but the additionalLength part of the header (probably?) can't be negative
			if (inbuf.length >= 8 && indat.getBigUint64(inbuf.length - 8, true) === 0n) {
				// blz() includes the zero'd header in decompression, so just keep it there
				return indat;
			} else {
				outbuf.set(inbuf, 0);
				outbuf.fill(0, inbuf.length, inbuf.length + 8);
				return new DataView(outbuf.buffer, 0, inbuf.length + 8);
			}
		}

		outbuf.fill(0xff, paddingStart, headerStart);

		outdat.setUint32(
			headerStart,
			(dataLength - decompressedLength) | ((headerStart + 8 - paddingStart) << 24),
			true,
		);
		outdat.setUint32(headerStart + 4, additionalLength, true);

		return new DataView(outbuf.buffer, dataStart, dataLength);
	});

	/**
	 * Decompresses the custom lzss-like used in various BIS files
	 */
	const lzBis = (window.lzBis = (indat) => {
		let inoff = 0;
		const readFunnyVarLength = () => {
			const composite = indat.getUint8(inoff++);
			const blen = composite >> 6;
			let out = composite & 0x3f;

			for (let i = 0, shift = 6; i < blen; ++i, shift += 6) out |= indat.getUint8(inoff++) << shift;
			return out;
		};

		const outsize = readFunnyVarLength();
		const blocks = readFunnyVarLength() + 1;

		const outbuf = new Uint8Array(outsize);
		let outoff = 0;
		for (let i = 0; i < blocks; ++i) {
			const blockLength = indat.getUint16(inoff, true);
			inoff += 2;
			block: for (let target = inoff + blockLength; inoff < target; ) {
				let byte = indat.getUint8(inoff++);
				for (let j = 0; j < 4; ++j, byte >>= 2) {
					switch (byte & 3) {
						case 0:
							break block;
						case 1:
							outbuf[outoff++] = indat.getUint8(inoff++);
							break;
						case 2: {
							const composite1 = indat.getUint8(inoff++);
							const composite2 = indat.getUint8(inoff++);
							const offset = composite1 | ((composite2 & 0xf0) << 4);
							const length = (composite2 & 0xf) + 2;
							for (let k = 0; k < length; ++k) {
								outbuf[outoff] = outbuf[outoff - offset];
								++outoff;
							}
							break;
						}
						case 3: {
							const length = indat.getUint8(inoff++) + 2;
							const byte = indat.getUint8(inoff++);
							for (let k = 0; k < length; ++k) outbuf[outoff++] = byte;
						}
					}
				}
			}
		}

		return Object.assign(new DataView(outbuf.buffer), { inoff });
	});

	/**
	 * Compresses the custom lzss-like format used in various BIS files.
	 * The compression matches **exactly** what you would find in a ROM. (i.e. lzBisCompress(lzBis(dat)) = dat)
	 * Using a custom `blockSize` larger than 512 will make the output smaller, but may cause the game to crash.
	 */
	const lzBisCompress = (window.lzBisCompress = (indat, blockSize = 512) => {
		const outbuf = new Uint8Array(indat.byteLength * 2);
		let outoff = 0;
		const writeFunnyVarLength = (x) => {
			if (x < 1 << 6) {
				outbuf[outoff++] = x;
			} else if (x < 1 << 14) {
				outbuf[outoff++] = (x & 0x3f) | 0x40;
				outbuf[outoff++] = x >> 6;
			} else {
				outbuf[outoff++] = (x & 0x3f) | 0x80;
				outbuf[outoff++] = (x >> 6) & 0xff; // note that these two overlap, i'm not sure why,
				outbuf[outoff++] = x >> 12; // but they do, and that's how it is
			}
		};
		writeFunnyVarLength(indat.byteLength);

		// each compression block will decompress into exactly 512 bytes of output
		const inblocks = [];
		for (let blockStart = 0; blockStart < indat.byteLength; blockStart += blockSize) {
			inblocks.push(sliceDataView(indat, blockStart, Math.min(blockStart + blockSize, indat.byteLength)));
		}
		writeFunnyVarLength(inblocks.length - 1);

		for (let i = 0; i < inblocks.length; ++i) {
			const inblock = inblocks[i];
			const blockLengthOffset = outoff;
			outoff += 2;

			let controlByteOffset = outoff++;
			let controlByteEntries = 0;

			for (let inoff = 0; inoff < inblock.byteLength; ) {
				const byte = inblock.getUint8(inoff);
				if (inoff + 1 >= inblock.byteLength) {
					// only a literal makes sense right now
					++inoff;
					outbuf[outoff++] = byte;
					outbuf[controlByteOffset] |= 1 << (controlByteEntries++ * 2);

					if (controlByteEntries >= 4) {
						controlByteOffset = outoff++;
						controlByteEntries = 0;
					}
					break;
				}

				const next = inblock.getUint8(inoff + 1);

				let bestRepetitions = 1;
				let bestBackReference = 0;
				let bestBackReferenceOffset;
				if (byte === next) {
					// repeated bytes; see how far the repetition goes
					for (
						bestRepetitions = 2;
						bestRepetitions < 257 && inoff + bestRepetitions < inblock.byteLength;
						++bestRepetitions
					) {
						if (inblock.getUint8(inoff + bestRepetitions) !== byte) break;
					}
				}

				// try back-references
				if (bestRepetitions <= 16) {
					const short = (next << 8) | byte;
					const globalInoff = inoff + i * blockSize;
					for (let j = Math.min(4095, globalInoff); j >= 2; --j) {
						const seekedShort = indat.getUint16(globalInoff - j, true);
						if (seekedShort === short) {
							let length = 2;
							for (; length < 17 && length < j && inoff + length < inblock.byteLength; ++length) {
								if (inblock.getUint8(inoff + length) !== indat.getUint8(globalInoff - j + length))
									break;
							}

							if (length > bestBackReference) {
								bestBackReference = length;
								bestBackReferenceOffset = j;
							}
						}
					}
				}

				if (bestBackReference > bestRepetitions && bestBackReference >= 2) {
					// prefer back references
					outbuf[outoff++] = bestBackReferenceOffset & 0xff;
					outbuf[outoff++] = ((bestBackReferenceOffset >> 4) & 0xf0) | (bestBackReference - 2);
					inoff += bestBackReference;

					outbuf[controlByteOffset] |= 2 << (controlByteEntries++ * 2);
				} else if (bestRepetitions >= 2) {
					// prefer repetitions
					outbuf[outoff++] = bestRepetitions - 2;
					outbuf[outoff++] = byte;
					inoff += bestRepetitions;

					outbuf[controlByteOffset] |= 3 << (controlByteEntries++ * 2);
				} else {
					// prefer literal
					outbuf[outoff++] = byte;
					++inoff;

					outbuf[controlByteOffset] |= 1 << (controlByteEntries++ * 2);
				}

				if (controlByteEntries >= 4) {
					controlByteOffset = outoff++;
					controlByteEntries = 0;
				}
			}

			const blockLength = outoff - blockLengthOffset - 2;
			outbuf[blockLengthOffset] = blockLength & 0xff;
			outbuf[blockLengthOffset + 1] = blockLength >> 8;
		}

		return new DataView(outbuf.buffer, 0, Math.ceil(outoff / 4) * 4);
	});

	// crc table (for speed)
	// TARGET: BA 78 E8 55, or 0x55e878ba
	// https://stackoverflow.com/questions/18638900/javascript-crc32
	const crcTable = new Uint32Array(256);
	for (let i = 0; i < 256; ++i) {
		let r = i;
		for (let j = 0; j < 8; ++j) {
			if (r & 1) r = 0xedb88320 ^ (r >>> 1);
			else r >>>= 1;
		}
		crcTable[i] = r;
	}

	/**
	 * Computes a standard CRC32 check value
	 * https://stackoverflow.com/questions/18638900/javascript-crc32
	 */
	const crc = (window.crc = (dat) => {
		const u8 = bufToU8(dat);
		let c = 0xffffffff;
		for (let i = 0; i < u8.length; ++i) c = (c >>> 8) ^ crcTable[(c & 0xff) ^ u8[i]];
		return c ^ 0xffffffff;
	});

	/**
	 * Computes an ADLER32 check value
	 * https://www.rfc-editor.org/rfc/pdfrfc/rfc1950.txt.pdf
	 */
	const adler32 = (window.adler32 = (dat) => {
		let s1 = 1;
		let s2 = 0;
		const u8 = bufToU8(dat);
		for (let i = 0; i < u8.length; ++i) {
			s1 = (s1 + u8[i]) % 65521;
			s2 = (s2 + s1) % 65521;
		}

		return s2 * 0x10000 + s1; // return unsigned
	});

	/**
	 * Creates an uncompressed .zip archive containing multiple files.
	 * This is intended to allow downloading several files at once.
	 * https://pkware.cachefly.net/webdocs/APPNOTE/APPNOTE-1.0.txt
	 * @param {{ name: string, dat: DataView }[]} files
	 * @returns {DataView}
	 */
	const zipStore = (window.zipStore = (files) => {
		let expectedSize = 26; // end of central directory
		for (const file of files) {
			expectedSize += 30 + file.name.length; // local file header
			expectedSize += file.dat.byteLength; // file data
			expectedSize += 46 + file.name.length; // central directory header
		}

		const dat = new DataView(new ArrayBuffer(expectedSize));
		const out8 = new Uint8Array(dat.buffer);
		let o = 0;

		// without specifying time (in MS-DOS format), files appear modified in 1979, which looks wrong
		const now = new Date();
		const date = now.getDate() | ((now.getMonth() + 1) << 5) | ((now.getFullYear() - 1980) << 9);
		const time = (now.getSeconds() >> 1) | (now.getMinutes() << 5) | (now.getHours() << 11);

		// local files
		const crc32s = [];
		const localHeaders = [];
		for (const { dat: fileDat, name } of files) {
			// local file header
			localHeaders.push(o);

			(dat.setUint32(o, 0x04034b50, true), (o += 4)); // local file header signature
			(dat.setUint16(o, 0, true), (o += 2)); // version needed to extract (0)
			(dat.setUint16(o, 0, true), (o += 2)); // general purpose bit flag (0)
			(dat.setUint16(o, 0, true), (o += 2)); // compression method (0 = no compression)
			(dat.setUint16(o, time, true), (o += 2)); // last mod file time (0)
			(dat.setUint16(o, date, true), (o += 2)); // last mod file date (0)
			const crc32LocalOffset = o;
			o += 4; // write crc-32 later
			(dat.setUint32(o, fileDat.byteLength, true), (o += 4)); // compressed size (0 = no compression)
			(dat.setUint32(o, fileDat.byteLength, true), (o += 4)); // uncompressed size
			(dat.setUint16(o, name.length, true), (o += 2)); // file name length
			(dat.setUint16(o, 0, true), (o += 2)); // extra field length

			// file name (part of local file header)
			for (let i = 0; i < name.length; ++i) dat.setUint8(o++, name.charCodeAt(i));

			// file data (in the meantime, calculate the crc32)
			// https://stackoverflow.com/questions/18638900/javascript-crc32
			let crc32 = 0xffffffff;
			for (let i = 0; i < fileDat.byteLength; ++i) {
				const byte = fileDat.getUint8(i);
				crc32 = (crc32 >>> 8) ^ crcTable[(crc32 & 0xff) ^ byte];
				out8[o++] = byte;
			}

			crc32 ^= 0xffffffff;
			dat.setUint32(crc32LocalOffset, crc32, true);
			crc32s.push(crc32);
		}

		// central directory
		const centralDirOffset = o;
		for (let i = 0; i < files.length; ++i) {
			const { dat: fileDat, name } = files[i];
			(dat.setUint32(o, 0x02014b50, true), (o += 4)); // central file header signature
			(dat.setUint16(o, 0x031e, true), (o += 2)); // version made by (3 = unix)
			(dat.setUint16(o, 0, true), (o += 2)); // version needed to extract (0)
			(dat.setUint16(o, 0, true), (o += 2)); // general purpose bit flag
			(dat.setUint16(o, 0, true), (o += 2)); // compression method (0 = no compression)
			(dat.setUint16(o, time, true), (o += 2)); // last mod file time
			(dat.setUint16(o, date, true), (o += 2)); // last mod file date
			(dat.setUint32(o, crc32s[i], true), (o += 4)); // crc32
			(dat.setUint32(o, fileDat.byteLength, true), (o += 4)); // compressed size (no compression is done)
			(dat.setUint32(o, fileDat.byteLength, true), (o += 4)); // uncompressed size
			(dat.setUint16(o, name.length, true), (o += 2)); // file name length
			(dat.setUint16(o, 0, true), (o += 2)); // extra field length
			(dat.setUint16(o, 0, true), (o += 2)); // file comment length
			(dat.setUint16(o, 0, true), (o += 2)); // disk number start
			(dat.setUint16(o, 0, true), (o += 2)); // internal file attributes
			(dat.setUint32(o, 0, true), (o += 4)); // external file attributes
			(dat.setInt32(o, localHeaders[i], true), (o += 4)); // relative offset of local header

			// file name
			for (let i = 0; i < name.length; ++i) dat.setUint8(o++, name.charCodeAt(i));
		}
		const centralDirSize = o - centralDirOffset;

		// end of central dir record
		(dat.setUint32(o, 0x06054b50, true), (o += 4)); // end of central dir signature
		(dat.setUint16(o, 0, true), (o += 2)); // number of this disk
		(dat.setUint16(o, 0, true), (o += 2)); // number of the disk...central directory
		(dat.setUint16(o, file.length, true), (o += 2)); // total number of entries...on this disk
		(dat.setUint16(o, file.length, true), (o += 2)); // total number of entries...central dir
		(dat.setUint32(o, centralDirSize, true), (o += 4)); // size of the central directory
		(dat.setInt32(o, centralDirOffset, true), (o += 4)); // offset of start of central directory...
		(dat.setUint32(o, 0, true), (o += 4)); // starting disk number
		(dat.setUint16(o, 0, true), (o += 2)); // zipfile comment length

		return dat;
	});

	/**
	 * Generates a compressed PNG v1.2 file. Compression is necessary; for reference, all rooms in FMapData.dat as
	 * uncompressed PNGs would take up to 558 MiB (whereas FMapData.dat itself is only 26.2 MiB).
	 * PNG: https://www.libpng.org/pub/png/spec/1.2/png-1.2.pdf
	 * Deflate: https://www.rfc-editor.org/rfc/pdfrfc/rfc1951.txt.pdf
	 */
	const png = (window.png = (u32, width, height) => {
		// count all used colors, and generate the uncompressed IDAT data (perhaps with a palette or not)
		let palette;
		let uncompressedIdatBuf;
		const seenColors = new Set(u32);
		if (seenColors.size <= 256) {
			// palette (assume 8-bit depth, anything below that is complicated and unnecessary)
			palette = [];
			const colorToIndex = new Map();
			for (const color of seenColors) {
				colorToIndex.set(color, colorToIndex.size);
				palette.push(color);
			}

			uncompressedIdatBuf = new Uint8Array((width + 1) * height);
			let inoff = 0;
			let outoff = 0;
			for (let y = 0; y < height; ++y) {
				uncompressedIdatBuf[outoff++] = 0; // no filter
				for (let x = 0; x < width; ++x) uncompressedIdatBuf[outoff++] = colorToIndex.get(u32[inoff++]);
			}
		} else {
			// rgb triplets
			uncompressedIdatBuf = new Uint8Array((width + 1) * height * 3);
			let inoff = 0;
			let outoff = 0;
			for (let y = 0; y < height; ++y) {
				uncompressedIdatBuf[outoff++] = 0; // no filter
				for (let x = 0; x < width; ++x) {
					uncompressedIdatBuf[outoff++] = u32[inoff];
					uncompressedIdatBuf[outoff++] = u32[inoff] >>> 8;
					uncompressedIdatBuf[outoff++] = u32[inoff++] >>> 16;
				}
			}
		}

		// TODO: what's a good maximum preallocation size?
		const outdat = new DataView(new ArrayBuffer(Math.ceil(uncompressedIdatBuf.byteLength * 1.5 + 10000)));
		const outbuf = bufToU8(outdat);
		let outoff = 0;

		// PNG header
		(outbuf.set([137, 80, 78, 71, 13, 10, 26, 10], 0), (outoff += 8));

		// IHDR chunk
		(outdat.setUint32(outoff, 13), (outoff += 4)); // chunk length
		(outbuf.set([0x49, 0x48, 0x44, 0x52], outoff), (outoff += 4)); // chunk type (IHDR)

		let chunkStart = outoff;
		(outdat.setUint32(outoff, width), (outoff += 4)); // image width
		(outdat.setUint32(outoff, height), (outoff += 4)); // image height
		outbuf[outoff++] = 8; // image bit depth
		outbuf[outoff++] = palette ? 3 : 2; // image color type (3 = palette, 2 = rgb triplets)
		outbuf[outoff++] = 0; // image compression method (0 = Deflate)
		outbuf[outoff++] = 0; // image filter method (0 = adaptive)
		outbuf[outoff++] = 0; // image interlace method (0 = no interlace)

		(outdat.setUint32(outoff, crc(sliceDataView(outdat, chunkStart - 4, outoff))), (outoff += 4)); // chunk crc

		if (palette) {
			// PLTE chunk
			(outdat.setUint32(outoff, palette.length * 3), (outoff += 4)); // chunk length
			(outbuf.set([0x50, 0x4c, 0x54, 0x45], outoff), (outoff += 4)); // chunk type (PLTE)

			chunkStart = outoff;
			for (let i = 0; i < palette.length; ++i) {
				outbuf[outoff++] = palette[i];
				outbuf[outoff++] = palette[i] >>> 8;
				outbuf[outoff++] = palette[i] >>> 16;
			}

			(outdat.setUint32(outoff, crc(sliceDataView(outdat, chunkStart - 4, outoff))), (outoff += 4)); // chunk crc
		}

		// IDAT chunk
		const idatLengthOffset = outoff; // write this after compression
		outoff += 4;
		(outbuf.set([0x49, 0x44, 0x41, 0x54], outoff), (outoff += 4)); // chunk type (IDAT)

		chunkStart = outoff;
		// zlib header
		outbuf[outoff++] = 8 | (7 << 4); // CM = 8 (Deflate), CINFO = 7 (32K window size)
		outbuf[outoff++] = 1; // FCHECK = 1, no preset dictionary, no compression level

		// Deflate, using fixed Huffman codes (dynamic is too complicated)
		const deflateStart = outoff;
		let outbit = 0;
		const writeBits = (x, bits) => {
			outbuf[outoff] |= x << outbit;
			outbuf[outoff + 1] |= x >> (8 - outbit);
			outbuf[outoff + 2] |= x >> (16 - outbit);
			outoff += (outbit + bits) >> 3;
			outbit = (outbit + bits) & 7;
		};

		const reverse = (x, bits) => {
			let y = 0;
			for (let xbit = 1, ybit = 1 << (bits - 1); ybit; xbit <<= 1, ybit >>= 1) {
				if (x & xbit) y |= ybit;
			}
			return y;
		};

		// Bruh
		const reversedLetterCodes = [];
		for (let x = 0; x <= 143; ++x) reversedLetterCodes[x] = reverse(0b00110000 + x, 8);
		for (let x = 144; x <= 255; ++x) reversedLetterCodes[x] = reverse(0b110010000 + (x - 144), 9);
		for (let x = 256; x <= 279; ++x) reversedLetterCodes[x] = reverse(0b0000000 + (x - 256), 7);
		for (let x = 280; x <= 287; ++x) reversedLetterCodes[x] = reverse(0b11000000 + (x - 280), 8);
		const writeLetterCode = (x) => {
			/*if (x <= 143) writeBits(0b00110000 + x, 8, true);
			else if (x <= 255) writeBits(0b110010000 + (x - 144), 9, true);
			else if (x <= 279) writeBits(0b0000000 + (x - 256), 7, true);
			else writeBits(0b11000000 + (x - 280), 8, true);*/
			if (x <= 143) writeBits(reversedLetterCodes[x], 8);
			else if (x <= 255) writeBits(reversedLetterCodes[x], 9);
			else if (x <= 279) writeBits(reversedLetterCodes[x], 7);
			else writeBits(reversedLetterCodes[x], 8);
		};

		const reversedDistCodes = [];
		for (let x = 0; x <= 31; ++x) reversedDistCodes[x] = reverse(x, 5);
		const writeDistCode = (x) => writeBits(reversedDistCodes[x], 5);

		writeBits(1, 1); // BFINAL = 1
		writeBits(0b01, 2); // BTYPE = 01 (fixed Huffman codes)

		const history = new Array(256);
		for (let i = 0; i < 256; ++i) history[i] = [];

		let inoff = 0;
		while (inoff < uncompressedIdatBuf.length) {
			const byte = uncompressedIdatBuf[inoff];

			let backReferenceLength = 2;
			let backReferenceOffset;

			const byteHistory = history[byte];
			for (let i = byteHistory.length - 1; i >= 0; --i) {
				const historyoff = byteHistory[i];
				if (inoff - historyoff > 0x8000) break;

				// shortcut check if historyoff could even increase backReferenceLength by checking the next byte
				if (
					uncompressedIdatBuf[inoff + backReferenceLength + 1] !==
					uncompressedIdatBuf[historyoff + backReferenceLength + 1]
				)
					continue;

				let length = 1;
				for (; length < 258; ++length) {
					if (uncompressedIdatBuf[inoff + length] !== uncompressedIdatBuf[historyoff + length]) break;
				}
				if (length > backReferenceLength) {
					backReferenceLength = length;
					backReferenceOffset = historyoff;
					if (backReferenceLength === 258) break;
				}
			}

			if (backReferenceLength >= 3) {
				// encode back reference
				// i don't actually think this would look better in a loop, copy+paste is clearer
				const l = backReferenceLength;
				if (l <= 10) writeLetterCode(257 + l - 3);
				else if (l <= 18) (writeLetterCode(265 + ((l - 11) >> 1)), writeBits((l - 11) & 1, 1));
				else if (l <= 34) (writeLetterCode(269 + ((l - 19) >> 2)), writeBits((l - 19) & 3, 2));
				else if (l <= 66) (writeLetterCode(273 + ((l - 35) >> 3)), writeBits((l - 35) & 7, 3));
				else if (l <= 130) (writeLetterCode(277 + ((l - 67) >> 4)), writeBits((l - 67) & 0xf, 4));
				else if (l <= 257) (writeLetterCode(281 + ((l - 131) >> 5)), writeBits((l - 131) & 0x1f, 5));
				else writeLetterCode(285); // length == 258

				const o = inoff - backReferenceOffset;
				if (o <= 4) writeDistCode(o - 1, 5);
				else if (o <= 8) (writeDistCode(4 + ((o - 5) >> 1), 5), writeBits((o - 5) & 1, 1));
				else if (o <= 16) (writeDistCode(6 + ((o - 9) >> 2), 5), writeBits((o - 9) & 3, 2));
				else if (o <= 32) (writeDistCode(8 + ((o - 17) >> 3), 5), writeBits((o - 17) & 7, 3));
				else if (o <= 64) (writeDistCode(10 + ((o - 33) >> 4), 5), writeBits((o - 33) & 0xf, 4));
				else if (o <= 128) (writeDistCode(12 + ((o - 65) >> 5), 5), writeBits((o - 65) & 0x1f, 5));
				else if (o <= 256) (writeDistCode(14 + ((o - 129) >> 6), 5), writeBits((o - 129) & 0x3f, 6));
				else if (o <= 512) (writeDistCode(16 + ((o - 257) >> 7), 5), writeBits((o - 257) & 0x7f, 7));
				else if (o <= 1024) (writeDistCode(18 + ((o - 513) >> 8), 5), writeBits((o - 513) & 0xff, 8));
				else if (o <= 2048) (writeDistCode(20 + ((o - 1025) >> 9), 5), writeBits((o - 1025) & 0x1ff, 9));
				else if (o <= 4096) (writeDistCode(22 + ((o - 2049) >> 10), 5), writeBits((o - 2049) & 0x3ff, 10));
				else if (o <= 8192) (writeDistCode(24 + ((o - 4097) >> 11), 5), writeBits((o - 4097) & 0x7ff, 11));
				else if (o <= 16384) (writeDistCode(26 + ((o - 8193) >> 12), 5), writeBits((o - 8193) & 0xfff, 12));
				else (writeDistCode(28 + ((o - 16385) >> 13), 5), writeBits((o - 16385) & 0x1fff, 13)); // offset <= 32768

				for (let i = 0; i < backReferenceLength; ++i) history[uncompressedIdatBuf[inoff]].push(inoff++);
			} else {
				// encode literal
				writeLetterCode(byte);
				history[byte].push(inoff++);
			}
		}

		writeLetterCode(256); // end of stream

		// exit Deflate, write zlib ADLER32
		++outoff; // round up to byte boundary
		(outdat.setUint32(outoff, adler32(uncompressedIdatBuf)), (outoff += 4));

		// exit zlib, complete IDAT chunk
		outdat.setUint32(idatLengthOffset, outoff - chunkStart); // chunk length
		(outdat.setUint32(outoff, crc(sliceDataView(outdat, chunkStart - 4, outoff))), (outoff += 4)); // chunk crc

		// IEND chunk
		(outdat.setUint32(outoff, 0), (outoff += 4)); // chunk length
		(outbuf.set([0x49, 0x45, 0x4e, 0x44], outoff), (outoff += 4)); // chunk type (IEND)
		(outdat.setUint32(outoff, crc(sliceDataView(outdat, outoff - 4, outoff))), (outoff += 4)); // chunk crc

		return sliceDataView(outdat, 0, outoff);
	});

	const rgb15To32 = (window.rgb15To32 = (in16) => {
		const out32 = new Uint32Array(in16.length);
		for (let i = 0; i < in16.length; ++i) {
			const r = in16[i] & 0x1f;
			const g = (in16[i] >> 5) & 0x1f;
			const b = (in16[i] >> 10) & 0x1f;
			out32[i] =
				0xff000000 |
				(b << (16 + 3)) |
				((b & 0x18) << (16 - 2)) |
				(g << (8 + 3)) |
				((g & 0x18) << (8 - 2)) |
				(r << 3) |
				(r >> 2);
		}
		return out32;
	});
};