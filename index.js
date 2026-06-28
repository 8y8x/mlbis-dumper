'use strict';

(async () => {
	const waitFor = cb =>
		new Promise(r => {
			let interval;
			interval = setInterval(() => {
				if (!cb()) return;
				clearInterval(interval);
				r();
			});
			const rqa = () => {
				if (cb()) r();
				else requestAnimationFrame(rqa);
			};
			rqa();
		});
	const loaded = document.querySelector('#loaded');
	let loadedCount = 1;
	const checks = [
		() => window.initDisassembler,
		() => window.initField,
		() => window.initAlgorithms,
		() => window.initRtti,
		() => window.initBai,
	];
	for (const cb of checks) {
		waitFor(cb).then(() => {
			++loadedCount;
			loaded.textContent = `${loadedCount}/${checks.length + 1} modules loaded`;
		});
	}

	const fileBlob = await new Promise(resolve => {
		const input = document.querySelector('#file-input');
		input.addEventListener('input', () => resolve(input.files[0]));
	});

	const fileLoadingStart = performance.now();

	const file = (window.file = new DataView(
		await new Promise(resolve => {
			const reader = new FileReader();
			reader.addEventListener('load', () => resolve(reader.result));
			reader.readAsArrayBuffer(fileBlob);
		}),
	));

	const sectionLoadingStart = performance.now();

	document.querySelector('#file-input').remove();
	document.querySelector('#title').remove();

	const settings = JSON.parse(localStorage.getItem('settings') || '{}');

	// +---------------------------------------------------------------------------------------------------------------+
	// | Components                                                                                                    |
	// +---------------------------------------------------------------------------------------------------------------+

	const dropdown = (window.dropdown = (values, initialIndex, onchange, onhover, hideArrows) => {
		const container = document.getElementById('dropdown').content.cloneNode(true);
		const dropdown = container.querySelector('.dropdown');
		const left = dropdown.querySelector('.left');
		const selection = dropdown.querySelector('.selection');
		const vee = dropdown.querySelector('.vee');
		const right = dropdown.querySelector('.right');
		const options = dropdown.querySelector('.options');
		const optionBase = dropdown.querySelector('.option');

		dropdown.values = values;

		const optionElements = [];
		let docListener;
		let open = false;
		let selected = initialIndex;
		const hide = () => {
			if (!open) return;
			if (docListener) removeEventListener('mousedown', docListener);
			options.style.visibility = 'hidden';
			open = false;
			docListener = undefined;
		};
		const select = (dropdown.select = (i, silent) => {
			optionElements[selected].style.color = '';
			optionElements[i].style.color = 'var(--dropdown-fg)';
			selection.innerHTML = values[i];

			selected = i;
			dropdown.value = i;
			dropdown.hovered = undefined;
			if (!silent) onchange(i);
		});

		for (let i = 0; i < values.length; ++i) {
			const value = values[i];
			const option = optionBase.cloneNode();
			option.innerHTML = value;
			options.appendChild(option);
			optionElements.push(option);

			option.addEventListener('mouseup', () => {
				hide();
				select(i);
			});

			option.addEventListener('mouseenter', () => {
				dropdown.hovered = i;
				onhover?.(i);
			});
		}
		optionBase.remove();

		options.addEventListener('mouseleave', () => {
			dropdown.hovered = undefined;
			onhover?.(undefined);
		});

		select(initialIndex, true);

		left.addEventListener('mousedown', () => {
			if (selected <= 0) return;
			select(selected - 1);
		});

		right.addEventListener('mousedown', () => {
			if (selected >= values.length - 1) return;
			select(selected + 1);
		});

		// not really a better way to do this
		let interval;
		interval = setInterval(() => {
			const box = options.getBoundingClientRect();
			if (box.width <= 0) return;
			clearInterval(interval);

			selection.style.width = `calc(${options.getBoundingClientRect().width - 2}px - ${hideArrows ? '0em' : '2em - 12px'})`;
		});

		if (hideArrows) {
			left.style.display = right.style.display = 'none';
			options.style.padding = '0 calc(1.5em + 6px) 0 0.5em';
			vee.style.display = 'inline-block';
		}

		selection.addEventListener('mousedown', e => {
			if (open) {
				hide();
				return;
			}

			const box = selection.getBoundingClientRect();
			let height;
			if (box.y > innerHeight / 2) {
				// top side has more space
				options.style.top = '';
				options.style.bottom = 'calc(1em + 8px - 2px)';
				height = box.y - 32;
				options.style.maxHeight = `${height}px`;
			} else {
				// bottom side has more space
				options.style.top = 'calc(1em + 8px - 2px)';
				options.style.bottom = '';
				height = innerHeight - box.y - 32;
				options.style.maxHeight = `calc(${height}px - 12px)`;
			}
			options.style.visibility = '';
			open = true;

			options.scroll(
				0,
				optionElements[selected].offsetTop + optionElements[selected].offsetHeight / 2 - height / 2,
			);

			if (docListener) return;
			docListener = e => {
				if (options.contains(e.target)) return;
				hide();
			};
			setTimeout(() => addEventListener('mousedown', docListener));
		});

		return dropdown;
	});

	const checkbox = (window.checkbox = (name, checked, onchange) => {
		const container = document.getElementById('checkbox').content.cloneNode(true);
		const checkbox = container.querySelector('.checkbox');
		const check = checkbox.querySelector('.check');
		const label = checkbox.querySelector('.label');

		label.innerHTML = name;
		if (name === '') {
			checkbox.style.padding = '0';
			label.remove();
		}

		checkbox.set = (newChecked, silent) => {
			checked = newChecked;
			checkbox.checked = checked;
			if (checked) checkbox.classList.add('checked');
			else checkbox.classList.remove('checked');
			if (!silent) onchange(checked);
		};

		checkbox.set(checked, true);
		checkbox.addEventListener('mousedown', () => checkbox.set(!checked));

		return checkbox;
	});

	const button = (window.button = (name, onchange) => {
		const button = document.createElement('button');
		button.innerHTML = name;
		button.addEventListener('mousedown', () => onchange());
		return button;
	});

	const hovery = (window.hovery = (html, onhover) => {
		const span = document.createElement('span');
		span.style.cssText =
			'background: #333; border: 1px solid #fff; color: #ccc; cursor: default; font-size: 0.9rem; padding: 0 3px;';
		span.innerHTML = html;
		span.addEventListener('mouseenter', () => {
			span.style.background = '#666';
			onhover(true);
		});
		span.addEventListener('mouseleave', () => {
			span.style.background = '#333';
			onhover(false);
		});
		return span;
	});

	// +---------------------------------------------------------------------------------------------------------------+
	// | Quick Data Display                                                                                            |
	// +---------------------------------------------------------------------------------------------------------------+

	const byteToChar = [];
	for (let i = 0; i < 0x20; ++i) byteToChar[i] = '.';
	for (let i = 0x20; i < 0x7f; ++i) byteToChar[i] = String.fromCharCode(i);
	for (let i = 0x7f; i < 0xa0; ++i) byteToChar[i] = '.';
	for (let i = 0xa0; i < 0x100; ++i) byteToChar[i] = String.fromCharCode(i);
	const latin1 = (window.latin1 = (o, l, dat) => {
		let end;
		if (l !== undefined) {
			end = o + l;
		} else {
			end = o;
			while (dat.getUint8(end)) ++end;
		}

		const u8 = bufToU8(sliceDataView(dat, o, Math.min(end, dat.byteLength)));
		const arr = new Array(u8.length);
		for (let i = 0; i < u8.length; ++i) arr[i] = byteToChar[u8[i]];
		return arr.join('');
	});

	const shiftJisDecoder = new TextDecoder('shift_jis');
	const shiftJis = (window.shiftJis = (dat, o) => {
		let end = o;
		while (end < dat.byteLength && dat.getUint8(end)) ++end;
		return shiftJisDecoder.decode(bufToU8(sliceDataView(dat, o, end)));
	});

	// barebones text, without any formatting or replacement characters
	const alphabetJP = [];
	alphabetJP.push('', 'ガ', 'ギ', 'グ', 'ゲ', 'ゴ', 'ザ', 'ジ', 'ズ', 'ゼ', 'ゾ', 'ダ', '×', 'ヅ', 'デ', 'ド');
	alphabetJP.push('バ', 'ビ', 'ブ', 'べ', 'ボ', 'が', 'ぎ', 'ぐ', 'げ', 'ご', 'ざ', 'じ', 'ず', 'ぜ', 'ぞ', 'ゃ');
	alphabetJP.push('', '！', 'ゅ', 'ょ', 'っ', '%', '&', "'", '(', ')', '・', '+', ',', '-', '.', '/');
	alphabetJP.push('０', '１', '２', '３', '４', '５', '６', '７', '８', '９', ':', ';', '。', '=', '、', '？');
	alphabetJP.push('一', 'Ａ', 'Ｂ', 'Ｃ', 'Ｄ', 'Ｅ', 'Ｆ', 'Ｇ', 'Ｈ', 'Ｉ', 'Ｊ', 'Ｋ', 'Ｌ', 'Ｍ', 'Ｎ', 'Ｏ');
	alphabetJP.push('Ｐ', 'Ｑ', 'Ｒ', 'Ｓ', 'Ｔ', 'Ｕ', 'Ｖ', 'Ｗ', 'Ｘ', 'Ｙ', 'Ｚ', '[', '¥', ']', 'わ', 'を');
	alphabetJP.push('ん', 'ａ', 'ｂ', 'ｃ', 'ｄ', 'ｅ', 'ｆ', 'ｇ', 'ｈ', 'ｉ', 'ｊ', 'ｋ', 'ｌ', 'ｍ', 'ｎ', 'ｏ');
	alphabetJP.push('ｐ', 'ｑ', 'ｒ', 'ｓ', 'ｔ', 'ｕ', 'ｖ', 'ｗ', 'ｘ', 'ｙ', 'ｚ', 'ば', 'び', 'ぶ', '〜', 'べ');
	alphabetJP.push('ぼ', 'ぱ', 'ぴ', 'ぷ', 'ぺ', '…', 'ぽ', 'だ', 'ぢ', 'づ', 'で', 'ど', 'ぁ', 'ぃ', 'ぅ', 'ぇ');
	alphabetJP.push('ぉ', 'あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ');
	alphabetJP.push('「', '」', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ャ', 'ュ', 'ョ', 'ッ', 'ア', 'イ', 'ウ', 'エ', 'オ');
	alphabetJP.push('カ', 'キ', 'ク', 'ケ', 'コ', 'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ッ', 'テ', 'ト', 'ナ');
	alphabetJP.push('ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ', 'マ', 'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ');
	alphabetJP.push('ヨ', 'ラ', 'リ', 'ル', 'レ', 'ロ', 'ワ', 'ン', 'パ', 'ピ', 'プ', 'ペ', 'ポ', 'た', 'ち', 'つ');
	alphabetJP.push('て', 'と', 'な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ', 'ま', 'み', 'む', 'め');
	alphabetJP.push('も', 'や', 'ゆ', 'よ', 'ら', 'り', 'る', 'れ', 'ろ');

	// TODO: which is masculine ordinal indicator?
	const alphabetLatin = [];
	alphabetLatin.push('', '⬆︎', '⮕', '⬇︎', '⬅︎', 'Ⓧ', '', 'Ⓨ', '', '♥︎', '♪', '★', '×', 'ᵉ', 'ᵉʳ', 'ʳᵉ');
	alphabetLatin.push('↑', '', '↓', '', '←', '', '→', '', 'Ⓛ', '', 'Ⓡ', '', 'Ⓐ', '', 'Ⓑ', '');
	alphabetLatin.push(' ', '!', '˝', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/');
	alphabetLatin.push('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '', '=', '', '?');
	alphabetLatin.push('˵', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O');
	alphabetLatin.push('P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '\\', ']', '', '_');
	alphabetLatin.push('`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o');
	alphabetLatin.push('p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '', '}', '~', '');
	alphabetLatin.push('©', '', ',', '', '„', '…', '●', '', '▲', '', '■', '', 'Œ', '', '', '');
	alphabetLatin.push('', '‘', '’', '“', '”', '•', '', '-', '', '', '', '', 'œ', '', '', '');
	alphabetLatin.push('', '¡', '', '', '', '¥', '', '', '', '', 'ª', '«', '', '', '', '');
	alphabetLatin.push('°', '', '', '', '', '', '', '', '', '', 'º', '»', '', '', '', '¿');
	alphabetLatin.push('À', 'Á', 'Â', '', 'Ä', 'Å', '', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï');
	alphabetLatin.push('', 'Ñ', 'Ò', 'Ó', 'Ô', '', 'Ö', '', '', 'Ù', 'Ú', 'Û', 'Ü', '', '', 'ẞ');
	alphabetLatin.push('à', 'á', 'â', '', 'ä', 'å', '', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î');
	alphabetLatin.push('ï', '', 'ñ', 'ò', 'ó', 'ô', '', 'ö', '', '', 'ù', 'ú', 'û', 'ü');

	const alphabetKO = [];
	const alphabetChinese = [];
	const bisUnicode = (window.bisUnicode = (dat, alphabetName) => {
		const u8 = bufToU8(dat);
		const out = [];

		for (let o = 0; o < u8.length; ) {
			const char = u8[o++];
			if (char === 0xff) {
				// formatting
				const control = u8[o++];
				if (control === 0)
					out.push(' '); // newline; ignore it here
				else if (control === 1) {
					// reset text
					out.push('\n');
					++o;
				} else if (control === 0x0a)
					++o; // close textbox
				else if (control === 0x0b)
					++o; // new textbox page
				else if (control === 0x0c)
					++o; // wait
				else if (control === 0x0f)
					o += 2; // variable display
				else if (control === 0x11) ++o;
				continue;
			}

			if (alphabetName === 'latin') {
				if (alphabetLatin[char]) out.push(alphabetLatin[char]);
			} else if (alphabetName === 'japanese' || alphabetName === 'korean') {
				if (char >= 0xf9) {
					out.push('?');
					++o;
				} else if (alphabetName === 'japanese') {
					if (alphabetJP[char]) out.push(alphabetJP[char]);
				} else if (alphabetName === 'korean') {
					if (alphabetKO[char]) out.push(alphabetKO[char]);
				}
			} else if (alphabetName === 'chinese') {
			}
		}

		return out.join('');
	});

	const byteToHex = [];
	for (let i = 0; i < 256; ++i) byteToHex[i] = i.toString(16).padStart(2, '0');
	const bytes = (window.bytes = (o, l, buf) => {
		const slice = new Uint8Array(
			buf.buffer.slice(Math.max(buf.byteOffset + o, 0), buf.byteOffset + Math.min(o + l, buf.byteLength)),
		);
		const arr = new Array(slice.length);
		for (let i = 0; i < slice.length; ++i) arr[i] = byteToHex[slice[i]];
		return arr.join(' ');
	});

	const bits = (window.bits = (o, l, buf) => {
		const slice = buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + l);
		return Array.from(new Uint8Array(slice))
			.map(x => x.toString(2).padStart(8, '0'))
			.join(' ');
	});

	const sanitize = (window.sanitize = s => s.replaceAll('<', '&lt;').replaceAll('>', '&gt;'));

	const addHTML = (window.addHTML = (el, html) => {
		const container = document.createElement(el.tagName); // tables do a *lot* of weird stuff without this
		container.innerHTML = html;
		// make a copy of childNodes first; it will end up empty
		for (const child of Array.from(container.childNodes)) el.append(child);
	});

	const writeRgb16 = (window.writeRgb16 = (bitmap, pixel, rgb16) => {
		const r = rgb16 & 0x1f;
		const g = (rgb16 >> 5) & 0x1f;
		const b = (rgb16 >> 10) & 0x1f;
		bitmap[pixel * 4] = (r << 3) | (r >> 2);
		bitmap[pixel * 4 + 1] = (g << 3) | (g >> 2);
		bitmap[pixel * 4 + 2] = (b << 3) | (b >> 2);
		bitmap[pixel * 4 + 3] = 255;
	});

	const str8 = (window.str8 = x => x.toString(16).padStart(2, '0'));
	const str16 = (window.str16 = x => x.toString(16).padStart(4, '0'));
	const str24 = (window.str24 = x => x.toString(16).padStart(6, '0'));
	const str32 = (window.str32 = x => x.toString(16).padStart(8, '0'));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Algorithms                                                                                                    |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initAlgorithms) await waitFor(() => window.initAlgorithms);
	window.initAlgorithms();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Misc                                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const unpackSegmentedFile = (window.unpackSegmentedFile = (headerDat, headerOffset, fileDat) => {
		if (headerDat.byteLength <= headerOffset) return [];

		const headerSize = headerDat.getUint32(headerOffset, true);
		const segments = [];
		for (let o = 4; o + 4 < headerSize; o += 4) {
			const from = headerDat.getUint32(headerOffset + o, true);
			const to = headerDat.getUint32(headerOffset + o + 4, true);
			segments.push(sliceDataView(fileDat, from, to));
		}

		// the last segment is not usable by the game (it doesn't have an upper bound), but it would be a bad artificial
		// limitation if the tool didn't let you peek its contents
		segments.push(sliceDataView(fileDat, headerDat.getUint32(headerOffset + headerSize - 4, true)));
		return segments;
	});

	const unpackSegmented32 = (window.unpackSegmented32 = dat => {
		if (!dat.byteLength) return [];

		const offsetsEnd = dat.getUint32(0, true); // offsets end where the first segment starts
		const segments = [];
		for (let o = 0; o + 4 < offsetsEnd; o += 4) {
			const from = dat.getUint32(o, true);
			const to = dat.getUint32(o + 4, true);
			segments.push(sliceDataView(dat, from, to));
		}

		// the last segment may or may not be usable by the game
		segments.push(sliceDataView(dat, dat.getUint32(offsetsEnd - 4, true), dat.byteLength));
		return segments;
	});

	const unpackSegmented16 = (window.unpackSegmented16 = dat => {
		if (!dat.byteLength) return [];

		const u16 = bufToU16(dat);
		const segments = [];
		const offsetsEnd = u16[0];
		for (let i = 0; i + 1 < offsetsEnd; ++i) {
			segments.push(sliceDataView(dat, u16[i] * 2, u16[i + 1] * 2));
		}

		// the last segment may or may not be usable by the game
		segments.push(sliceDataView(dat, u16[offsetsEnd - 1] * 2, dat.byteLength));
		return segments;
	});

	const unpackSegmentedUnsorted = (window.unpackSegmentedUnsorted = (dat, o = 0) => {
		let min = Infinity;
		const offsets = [];
		for (; o < dat.byteLength && o < min; o += 4) {
			const offset = dat.getUint32(o, true);
			offsets.push({ offset });
			if (offset < min) min = offset;
		}

		const offsetsSorted = [...offsets];
		offsetsSorted.sort(({ offset: a }, { offset: b }) => a - b);
		for (let i = 0; i < offsetsSorted.length; ++i) {
			offsetsSorted[i].until = offsetsSorted[i + 1]?.offset ?? dat.byteLength;
		}

		const segments = [];
		for (const { offset, until } of offsets) {
			segments.push(sliceDataView(dat, offset, until));
		}

		return segments;
	});

	const sliceDataView = (window.sliceDataView = (dat, start, end) =>
		new DataView(dat.buffer, dat.byteOffset + start, end - start));
	const bufToU8 = (window.bufToU8 = (buf, off = buf.byteOffset, len = buf.byteLength) =>
		new Uint8Array(buf.buffer, off, len));
	const bufToU8Clamped = (window.bufToU8Clamped = (buf, off = buf.byteOffset, len = buf.byteLength) =>
		new Uint8ClampedArray(buf.buffer, off, len));
	const bufToU16 = (window.bufToU16 = (buf, off = buf.byteOffset, len = buf.byteLength >> 1) =>
		new Uint16Array(buf.buffer, off, len));
	const bufToS16 = (window.bufToS16 = (buf, off = buf.byteOffset, len = buf.byteLength >> 1) =>
		new Int16Array(buf.buffer, off, len));
	const bufToU32 = (window.bufToU32 = (buf, off = buf.byteOffset, len = buf.byteLength >> 2) =>
		new Uint32Array(buf.buffer, off, len));
	const bufToS32 = (window.bufToS32 = (buf, off = buf.byteOffset, len = buf.byteLength >> 2) =>
		new Int32Array(buf.buffer, off, len));
	const bufToDat = (window.bufToDat = (buf, off = buf.byteOffset, len = buf.byteLength) =>
		new DataView(buf.buffer, off, len));

	const download = (window.download = (name, dat, mime = 'application/octet-stream') => {
		const blob = new Blob([dat], { type: mime });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = name;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000); // idk if a timeout is really necessary
	});

	const readMessage = (window.readMessage = (o, dat, ignoreSpecials) => {
		const u8 = bufToU8(dat);
		const s = [];
		for (; o < u8.length; ) {
			const byte = u8[o++];
			if (byte === 0xff) {
				const next = u8[o++];
				if (next === 0) s.push('\n');
				else if (ignoreSpecials) s.push(' ');
				else s.push(`<${str8(next)}>`);
			} else if (byte <= 0x1f || byte >= 0xfa || byte === 0x7f) {
				// special symbol
				if (ignoreSpecials) s.push(' ');
				else s.push(`(${str8(byte)})`);
			} else if (byte === 0x85) {
				s.push('…');
			} else {
				// assume latin1
				s.push(String.fromCharCode(byte));
			}
		}

		return s.join('');
	});

	const createSection = (window.createSection = (title, cb) => {
		const section = document.createElement('section');
		const reveal = document.createElement('div');
		reveal.className = 'reveal';
		reveal.innerHTML = `<code>[-]</code> ${title}`;
		section.appendChild(reveal);

		const content = document.createElement('div');
		content.className = 'content';
		section.appendChild(content);

		let visible = true;
		const toggleVisible = newVisible => {
			if (newVisible === visible) return;
			visible = newVisible;
			settings[`section.${title}.visible`] = visible;
			localStorage.setItem('settings', JSON.stringify(settings));

			content.style.display = visible ? '' : 'none';
			reveal.innerHTML = `<code>${visible ? '[-]' : '[+]'}</code> ${title}`;

			section.style.height = visible ? '' : '32px';
		};
		reveal.addEventListener('mousedown', e => {
			if (e.button === 0) toggleVisible(!visible);
		});
		toggleVisible(settings[`section.${title}.visible`] ?? true);

		let result;
		try {
			result = cb(content);
		} catch (err) {
			console.error(err);
			addHTML(
				content,
				`<span style="color: #f99;">${sanitize(err.name)}: ${sanitize(err.message)}<br>
				${sanitize(err.stack).replaceAll('\n', '<br>')}</span>`,
			);
		}

		if (content.children.length) document.body.appendChild(section);
		return result;
	});

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: ROM Headers                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const headers = (window.headers = createSection('ROM Headers', section => {
		const headers = {};

		const invalid = '<span style="color: var(--red)">(INVALID)</span>';

		const ul = document.createElement('ul');

		headers.title = latin1(0, 12, file);
		headers.gamecode = latin1(0xc, 4, file);
		addHTML(ul, `<li>Title: ${headers.title} (${headers.gamecode})</li>`);
		document.title = `(${headers.gamecode}) MLBIS Dumper`;

		headers.makercode = latin1(0x10, 2, file);
		headers.unitcode = file.getUint8(0x12);

		headers.arm9RomOffset = file.getUint32(0x20, true);
		headers.arm9Entry = file.getUint32(0x24, true);
		headers.arm9RamOffset = file.getUint32(0x28, true);
		headers.arm9Size = file.getUint32(0x2c, true);
		addHTML(
			ul,
			`<li>
				ARM9 initializer: <ul>
					<li>ROM offset: <code>0x${str32(headers.arm9RomOffset)}</code></li>
					<li>RAM entry: <code>0x${str32(headers.arm9Entry)}</code></li>
					<li>RAM offset: <code>0x${str32(headers.arm9RamOffset)}</code></li>
					<li>Length: <code>0x${str32(headers.arm9Size)}</code></li>
				</ul>
			</li>`,
		);

		headers.arm7RomOffset = file.getUint32(0x30, true);
		headers.arm7RamEntry = file.getUint32(0x34, true);
		headers.arm7RamOffset = file.getUint32(0x38, true);
		headers.arm7Size = file.getUint32(0x3c, true);
		addHTML(
			ul,
			`<li>
				ARM7 initializer: <ul>
					<li>ROM offset: <code>0x${str32(headers.arm7RomOffset)}</code></li>
					<li>RAM entry: <code>0x${str32(headers.arm7RamEntry)}</code></li>
					<li>RAM offset: <code>0x${str32(headers.arm7RamOffset)}</code></li>
					<li>Length: <code>0x${str32(headers.arm7Size)}</code></li>
				</ul>
			</li>`,
		);

		headers.fntOffset = file.getUint32(0x40, true);
		headers.fntLength = file.getUint32(0x44, true);
		addHTML(
			ul,
			`<li>
				File Name Table (FNT): <code>0x${str32(headers.fntOffset)}</code>, ` +
				`len <code>0x${headers.fntLength.toString(16)}
			</li>`,
		);

		headers.fatOffset = file.getUint32(0x48, true);
		headers.fatLength = file.getUint32(0x4c, true);
		addHTML(
			ul,
			`<li>
				File Allocation Table (FAT): <code>0x${str32(headers.fatOffset)}</code>, ` +
				`len <code>0x${headers.fatLength.toString(16)}
			</li>`,
		);

		headers.ovt9Offset = file.getUint32(0x50, true);
		headers.ovt9Length = file.getUint32(0x54, true);
		addHTML(
			ul,
			`<li>
				ARM9 Overlay Table (OVT9): <code>0x${str32(headers.ovt9Offset)}</code>, ` +
				`len <code>0x${headers.ovt9Length.toString(16)}
			</li>`,
		);

		headers.ovt7Offset = file.getUint32(0x58, true);
		headers.ovt7Length = file.getUint32(0x5c, true);
		addHTML(
			ul,
			`<li>
				ARM7 Overlay Table (OVT7): <code>0x${str32(headers.ovt7Offset)}</code>, ` +
				`len <code>0x${headers.ovt7Length.toString(16)}
			</li>`,
		);

		headers.titleOffset = file.getUint32(0x68, true);
		addHTML(ul, `<li>Icon/Title offset: <code>0x${str32(headers.titleOffset)}</code></li>`);

		headers.arm9AutoLoadHook = file.getUint32(0x70, true);
		addHTML(ul, `<li>ARM9 Auto Load Hook: <code>0x${str32(headers.arm9AutoLoadHook)}</code></li>`);

		headers.arm7AutoLoadHook = file.getUint32(0x74, true);
		addHTML(ul, `<li>ARM7 Auto Load Hook: <code>0x${str32(headers.arm7AutoLoadHook)}</code></li>`);

		headers.romLength = file.getUint32(0x80, true);
		addHTML(ul, `<li>Total ROM length: <code>0x${str32(headers.romLength)}</code></li>`);

		headers.headerLength = file.getUint32(0x84, true);
		addHTML(ul, `<li>Total ROM header length: <code>0x${headers.headerLength.toString(16)}</code></li>`);

		headers.logoCompressed = sliceDataView(file, 0xc0, 0xc0 + 0x9c);
		headers.logoCompressedCrc16 = file.getUint16(0x15c, true);
		const actualLogoCompressedCrc16 = crc16(headers.logoCompressed);
		addHTML(
			ul,
			`<li>
				Nintendo logo CRC16: <code>0x${str16(headers.logoCompressedCrc16)}</code>
				(actual: <code>0x${str16(actualLogoCompressedCrc16)}</code>, expected: <code>0xcf56</code>)
				${headers.logoCompressedCrc16 !== actualLogoCompressedCrc16 ? invalid : ''}
			</li>`,
		);

		headers.headerCrc16 = file.getUint16(0x15e, true);
		const actualHeaderCrc16 = crc16(sliceDataView(file, 0, 0x15e));
		addHTML(
			ul,
			`<li>
				Header CRC16: <code>0x${str16(headers.headerCrc16)}</code>
				(actual: <code>0x${str16(actualHeaderCrc16)}</code>)
				${headers.headerCrc16 !== actualHeaderCrc16 ? invalid : ''}
			</li>`,
		);

		headers.signatureFlags = file.getUint8(0x1bf);
		headers.dsiIconTitleHmac = sliceDataView(file, 0x33c, 0x33c + 0x14);
		headers.dsiHeaderHmac = sliceDataView(file, 0x378, 0x378 + 0x14); // TODO: "and ARM9+ARM7 areas"?
		headers.dsiOvt9AndFatHmac = sliceDataView(file, 0x38c, 0x38c + 0x14);
		headers.dsiRsaSignature = sliceDataView(file, 0xf80, 0x1000);

		section.appendChild(ul);

		return headers;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: File System                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const fs = (window.fs = createSection('File System', section => {
		const fs = new Map();

		fs.arm9 = sliceDataView(file, headers.arm9RomOffset, headers.arm9RomOffset + headers.arm9Size);
		fs.arm9BssSize = 0;
		fs.arm7 = sliceDataView(file, headers.arm7RomOffset, headers.arm7RomOffset + headers.arm7Size);
		fs.autoloads = [];

		let arm9DecompressedPacked;
		let arm9Unpacked = false;

		const moduleParamsInfo = document.createElement('div'); // add to DOM later

		// some games compress the ARM9 region, but only partially
		// headers.arm9Size cannot be trusted - for example, JP version specifies 0x550b8 (decompressed size) when the
		// ARM9 is actually 0x3718c in size
		const moduleParamsAddr = fs.arm9.getUint32(headers.arm9AutoLoadHook - 4 - headers.arm9RamOffset, true);
		if (
			headers.arm9RamOffset < moduleParamsAddr &&
			moduleParamsAddr + 0x24 < headers.arm9RamOffset + fs.arm9.byteLength
		) {
			const [
				autoloadListStart,
				autoloadListEnd,
				autoloadStart,
				arm9BssStart,
				arm9BssEnd,
				compressionHead,
				sdkVersion,
				code1,
				code2,
			] = bufToU32(
				sliceDataView(
					fs.arm9,
					moduleParamsAddr - headers.arm9RamOffset,
					moduleParamsAddr + 0x28 - headers.arm9RamOffset,
				),
			);

			if (code1 === 0xdec00621 && code2 === 0x2106c0de) {
				fs.arm9BssSize = arm9BssEnd - arm9BssStart;

				if (compressionHead) {
					// the rest of the ARM9 is compressed, so decompress it
					// note that headers.arm9Size does not always match this. for example, the JP release specifies the
					// *decompressed* size, which would put you midway into like overlay 2 or something on the ROM
					arm9DecompressedPacked = fs.arm9 = blz(
						sliceDataView(fs.arm9, 0, compressionHead - headers.arm9RamOffset),
					);
				}

				const sdkMajorVersion = sdkVersion >>> 24;
				const sdkMinorVersion = (sdkVersion >>> 16) & 0xff;
				const sdkPatch = sdkVersion & 0xffff;
				addHTML(
					moduleParamsInfo,
					`<div>NitroSDK ${sdkMajorVersion}.${sdkMinorVersion} (patch ${sdkPatch})</div>`,
				);

				let copyAddr = autoloadStart;
				for (let i = 0, o = autoloadListStart; o < autoloadListEnd; ++i, o += 12) {
					const ramStart = fs.arm9.getUint32(o - headers.arm9RamOffset, true);
					const ramSize = fs.arm9.getUint32(o + 4 - headers.arm9RamOffset, true);
					const bssSize = fs.arm9.getUint32(o + 8 - headers.arm9RamOffset, true);

					let name, fileName;
					if (ramStart === 0x01ff8000) {
						name = 'ITCM';
						fileName = 'itcm.bin';
					} else if (ramStart === 0x027e0000) {
						// DTCM can be put elsewhere but i think it's usually put here
						name = 'DTCM';
						fileName = 'dtcm.bin';
					} else {
						name = `ARM9 Autoload[${i}]`;
						fileName = `autoload${i}.bin`;
					}

					fs.autoloads.push({
						name,
						fileName,
						ramStart,
						ramSize,
						bssSize,
						dat: sliceDataView(
							fs.arm9,
							copyAddr - headers.arm9RamOffset,
							copyAddr + ramSize - headers.arm9RamOffset,
						),
					});

					addHTML(
						moduleParamsInfo,
						`<div>
							${name}: <code>${str32(ramStart)} - ${str32(ramStart + ramSize)}</code>
							(len <code>0x${ramSize.toString(16)}</code>, BSS <code>0x${bssSize.toString(16)}</code>),
							copied from ARM9 <code>${str32(copyAddr)} - ${str32((copyAddr += ramSize))}</code>
						</div>`,
					);
				}

				fs.arm9 = sliceDataView(fs.arm9, 0, arm9BssStart - headers.arm9RamOffset);
				arm9Unpacked = true;
			} else {
				addHTML(moduleParamsInfo, `<div>(Can't read autoload section - is this a DSi game?)</div>`);
			}
		}

		const names = new Map();
		names.set(0xf000, ''); // so every file path starts with '/'
		const parents = new Map();
		const numDirectories = file.getUint16(headers.fntOffset + 6, true);
		for (let i = 0; i < numDirectories; ++i) {
			let o = file.getUint32(headers.fntOffset + i * 8, true);
			let fileId = file.getUint16(headers.fntOffset + i * 8 + 4, true);

			while (true) {
				const composite = file.getUint8(headers.fntOffset + o++);
				if (!composite) break;

				const name = latin1(headers.fntOffset + o, composite & 0x7f, file);
				o += composite & 0x7f;
				let id;
				if (composite & 0x80) {
					id = file.getUint16(headers.fntOffset + o, true);
					o += 2;
				} else id = fileId++;
				names.set(id, name);
				parents.set(id, 0xf000 + i);
			}
		}

		const fileToOverlayId = (fs.fileToOverlayId = new Map());
		const overlayEntries = (fs.overlayEntries = new Map());
		for (let i = 0, o = headers.ovt9Offset; i * 32 < headers.ovt9Length; ++i, o += 32) {
			const segment = bufToU32(sliceDataView(file, o, o + 32));
			const [id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compressed] = segment;
			fileToOverlayId.set(fileId, id);
			overlayEntries.set(id, { id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compressed });
		}

		const overlayCache = new Map();
		fs.overlay = (id, noCache) => {
			const cached = overlayCache.get(id);
			if (cached) return cached;

			// no errors!
			const entry = overlayEntries.get(id);
			let dat = fs.get(entry.fileId);
			if (entry?.compressed) dat = blz(dat);
			if (dat && !noCache) overlayCache.set(id, Object.assign(dat, { entry }));
			return dat;
		};

		for (let i = 0, o = headers.fatOffset; i * 8 < headers.fatLength; ++i, o += 8) {
			const start = file.getUint32(o, true);
			const end = file.getUint32(o + 4, true);

			let name, path;
			const overlayId = fileToOverlayId.get(i);
			if (overlayId !== undefined) {
				const entry = overlayEntries.get(overlayId);
				name = `overlay${overlayId.toString().padStart(4, '0')}.bin`;
				path = `(overlay ${overlayId.toString().padStart(4, '0')}${entry.compressed ? ', compressed' : ''})`;
			} else {
				name = names.get(i);
				path = name;
				let parentId = parents.get(i);
				for (let j = 0; j < 100 && parentId !== undefined; ++j) {
					path = names.get(parentId) + '/' + path;
					parentId = parents.get(parentId);
				}
			}

			const obj = Object.assign(sliceDataView(file, start, end), { name, path, start, end });
			fs.set(i, obj);
			if (overlayId === undefined) fs.set(path, obj);
		}

		const singleExport = document.createElement('div');
		singleExport.textContent = 'File: ';
		section.appendChild(singleExport);

		const error = () => {
			throw 0;
		};
		const singleSelectEntries = [
			{
				label: `ARM9 (len 0x${fs.arm9.byteLength.toString(16)})`,
				fileName: 'arm9.bin',
				getDat: () => sliceDataView(file, headers.arm9RomOffset, headers.arm9RomOffset + headers.arm9Size),
				getBlzDat: () => arm9DecompressedPacked || error(),
				getBlzUnpackedDat: () => fs.arm9,
			},
			{
				label: `ARM7 (len 0x${fs.arm7.byteLength.toString(16)})`,
				fileName: 'arm7.bin',
				getDat: () => sliceDataView(file, headers.arm7RomOffset, headers.arm7RomOffset + headers.arm7Size),
				getBlzDat: () => fs.arm7,
			},
		];

		for (let i = 0; i < fs.autoloads.length; ++i) {
			const autoload = fs.autoloads[i];
			singleSelectEntries.push({
				label: `${autoload.name} (len 0x${autoload.dat.byteLength.toString(16)})`,
				fileName: autoload.fileName,
				getDat: () => autoload.dat,
			});
		}

		for (let i = 0; i * 8 < headers.fatLength; ++i) {
			const dat = fs.get(i);
			const { start, end, name, path } = dat;

			let getBlzDat;
			const ovid = fileToOverlayId.get(i);
			if (ovid !== undefined && overlayEntries.get(ovid).compressed) {
				getBlzDat = () => fs.overlay(ovid, true);
			}

			singleSelectEntries.push({
				label: `0x${str8(i)}. (len 0x${(end - start).toString(16)}) ${sanitize(path)}`,
				fileName: name,
				getDat: () => dat,
				getBlzDat,
			});
		}

		// ARM9: "Raw" or "BLZ" or "BLZ + Unpacked"
		// ARM7: "Raw"
		// overlays: "Raw" or "BLZ"
		// files: "Raw"
		const singleSelect = dropdown(
			singleSelectEntries.map(x => x.label),
			0,
			() => {
				// when switching files, change the selected dropdown, and change the value of that dropdown to whatever was
				// selected on the previous dropdown (or "Raw" if it's not available anymore)
				const entry = singleSelectEntries[singleSelect.value];

				let newDecompDropdown;
				if (entry.getBlzUnpackedDat) newDecompDropdown = decompBlzUnpacked;
				else if (entry.getBlzDat) newDecompDropdown = decompBlz;
				else newDecompDropdown = decompRawOnly;

				if (newDecompDropdown === singleDecompDropdown) return; // no need to change
				newDecompDropdown.select(newDecompDropdown.values.length - 1, true); // the best option is the last one
				singleDecompDropdown.style.display = 'none';
				newDecompDropdown.style.display = 'inline-block';
				singleDecompDropdown = newDecompDropdown;
			},
		);
		singleExport.appendChild(singleSelect);

		const decompRawOnly = dropdown(['Raw'], 0, () => {}, undefined, true);
		const decompBlz = dropdown(['Raw', 'Decompressed (BLZ)'], 1, () => {}, undefined, true);
		const decompBlzUnpacked = dropdown(
			['Raw', 'Decompressed (BLZ)', 'Decompressed + Unpacked'],
			2,
			() => {},
			undefined,
			true,
		);
		decompRawOnly.style.display = decompBlz.style.display = decompBlzUnpacked.style.display = 'none';
		singleExport.appendChild(decompRawOnly);
		singleExport.appendChild(decompBlz);
		singleExport.appendChild(decompBlzUnpacked);

		let singleDecompDropdown = arm9Unpacked ? decompBlzUnpacked : decompBlz;
		singleDecompDropdown.style.display = 'inline-block';

		const singleDump = button('Dump', () => {
			const entry = singleSelectEntries[singleSelect.value];

			let dat;
			try {
				if (singleDecompDropdown.value === 0) dat = entry.getDat();
				else if (singleDecompDropdown.value === 1) dat = entry.getBlzDat();
				else if (singleDecompDropdown.value === 2) dat = entry.getBlzUnpackedDat();
			} catch (err) {
				console.error(err);
				singleOutput.textContent = '(Failed to decompress)';
				return;
			}

			if (!dat) {
				singleOutput.textContent = '(Failed to decompress)';
				return;
			}

			singleOutput.textContent = '';
			download(entry.fileName, dat);
		});
		singleExport.appendChild(singleDump);

		const singleOutput = document.createElement('span');
		singleExport.appendChild(singleOutput);

		const multiExport = document.createElement('div');
		multiExport.textContent = 'Everything: ';
		section.appendChild(multiExport);

		const multiDump = button('Dump Everything', () => {
			const files = [
				{ name: 'arm9.bin', dat: fs.arm9 },
				{ name: 'arm7.bin', dat: fs.arm7 },
			];

			for (const autoload of fs.autoloads) files.push({ name: autoload.fileName, dat: autoload.dat });

			for (let i = 0; i * 8 < headers.fatLength; ++i) {
				const fsentry = fs.get(i);
				const overlayId = fileToOverlayId.get(i);
				if (overlayId !== undefined) {
					const dat = fs.overlay(overlayId, true);
					const suffix = dat === fsentry ? '' : '-decomp';
					files.push({ name: `overlay${String(overlayId).padStart(4, '0')}${suffix}.bin`, dat });
				} else {
					files.push({ name: fsentry.name, dat: fsentry });
				}
			}
			download(`${headers.gamecode}.zip`, zipStore(files));
		});
		multiExport.appendChild(multiDump);

		addHTML(section, '<br>');
		section.appendChild(moduleParamsInfo);
		addHTML(section, '<br>');

		const sorting = dropdown(['Sort by index', 'Sort by length'], 0, () => update(), undefined, true);
		section.appendChild(sorting);

		const listContainer = document.createElement('div');
		section.appendChild(listContainer);
		const update = () => {
			listContainer.innerHTML = '';
			const list = [];
			for (let i = 0; i * 8 < headers.fatLength; ++i) list.push([i, fs.get(i)]);

			if (sorting.value === 1) list.sort(([_, a], [__, b]) => a.end - a.start - (b.end - b.start));

			for (let i = 0; i < list.length; ++i) {
				const [index, { path, start, end }] = list[i];
				const lengthStr = (end - start).toString(16);
				addHTML(
					listContainer,
					`<div><code>0x${str8(index)}. 0x${str32(start)} - 0x${str32(end)} (len 0x${lengthStr})
						${'&nbsp;'.repeat(8 - lengthStr.length)} ${path}</code></div>`,
				);
			}
		};
		update();

		return fs;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Overlay Table                                                                                        |
	// +---------------------------------------------------------------------------------------------------------------+

	const ovt = (window.ovt = createSection('Overlay Table', section => {
		const ovt = {};

		const mode = dropdown(['RAM Arrangement', 'Overlay Entries', 'String Search'], 0, () => update());
		section.appendChild(mode);

		ovt.overlays = [];
		for (let i = 0, o = headers.ovt9Offset; o < headers.ovt9Offset + headers.ovt9Length; ++i, o += 0x20) {
			const overlayU32 = bufToU32(sliceDataView(file, o, o + 0x20));
			const [id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compression] = overlayU32;
			ovt.overlays.push({ id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compression });
		}

		let downloadCallback = () => {};
		const downloadButton = button('Download', () => downloadCallback());
		downloadButton.style.display = 'none';
		section.appendChild(downloadButton);

		const preview = document.createElement('div');
		preview.style.cssText = 'position: relative';
		section.appendChild(preview);

		const updateRamArrangement = () => {
			let contentHeight = 0;
			const entries = [];

			let selected;
			const updateColors = () => {
				if (selected) {
					const sl = selected.leftAddress;
					const sr = selected.leftAddress + selected.size + selected.bss;
					for (const entry of entries) {
						const l = entry.leftAddress;
						const r = entry.leftAddress + entry.size + entry.bss;
						// start < other.start + other.length && other.start < start + length
						if (entry === selected) {
							entry.row.classList.remove('red');
							entry.row.classList.remove('green');
						} else if (l < sr && sl < r) {
							// the two entries intersect, so they can't possibly be loaded together
							entry.row.classList.add('red');
							entry.row.classList.remove('green');
						} else {
							entry.row.classList.remove('red');
							entry.row.classList.add('green');
						}
					}
				} else {
					for (const { row } of entries) {
						row.classList.remove('red');
						row.classList.remove('green');
					}
				}
			};

			const START = 0x01ff8000;
			const END = 0x02400000;
			const SIZE = END - START;
			const addEntry = (label, leftAddress, size, bss) => {
				const row = document.createElement('div');
				row.style.cssText = `position: absolute; top: ${contentHeight}px; left: 0px; height: 20px; width: 100%; color: var(--clicky-text);`;
				row.className = 'clicky';
				preview.appendChild(row);

				const left = document.createElement('div');
				left.style.cssText = `position: absolute; top: 0; left: 0; height: 20px; width: 240px; font: 16px "Red Hat Mono";`;
				left.innerHTML = `${'&nbsp;'.repeat(4 - label.length)}${label}.
					${str32(leftAddress)}-${str32(leftAddress + size)}`;
				row.appendChild(left);

				const right = document.createElement('div');
				right.style.cssText = `background: var(--clicky-bg); position: absolute; top: 0; left: 240px; height: 20px; width: calc(100% - 240px);`;
				row.appendChild(right);

				const boxExecutable = document.createElement('div');
				boxExecutable.style.cssText = `background: var(--clicky-fill); border: 1px solid var(--clicky-box); position: absolute; top: 0; height: 20px;`;
				boxExecutable.style.left = `${((leftAddress - START) / SIZE) * 100}%`;
				boxExecutable.style.width = `${(size / SIZE) * 100}%`;
				right.appendChild(boxExecutable);

				const boxStatic = document.createElement('div');
				boxStatic.style.cssText = `background: var(--clicky-fill); position: absolute; top: 0; height: 20px;`;
				boxStatic.style.left = `${((leftAddress + size - START) / SIZE) * 100}%`;
				boxStatic.style.width = `${(bss / SIZE) * 100}%`;
				right.appendChild(boxStatic);

				let bssLabel;
				if (bss) {
					bssLabel = document.createElement('div');
					bssLabel.style.cssText = `position: absolute; top: 0; height: 20px; font: 1em "Red Hat Mono"`;
					const leftPercent = ((leftAddress + size + bss - START) / SIZE) * 100;
					if (leftPercent < 80) {
						bssLabel.style.left = `calc(${leftPercent}% + 10px)`;
					} else {
						bssLabel.style.right = `calc(${100 - ((leftAddress - START) / SIZE) * 100}% + 10px)`;
					}
					bssLabel.textContent = `(BSS 0x${bss.toString(16)})`;
					right.appendChild(bssLabel);
				}

				const entry = { label, leftAddress, size, bss, row };
				entries.push(entry);
				row.addEventListener('mousedown', () => {
					if (selected) {
						selected.row.classList.remove('active');
						if (selected === entry) {
							selected = undefined;
							updateColors();
							return;
						}
					}

					selected = entry;
					row.classList.add('active');
					updateColors();
				});

				contentHeight += 20;
			};

			addEntry('ARM9', headers.arm9RamOffset, fs.arm9.byteLength, fs.arm9BssSize);

			for (let i = 0; i < fs.autoloads.length; ++i) {
				const autoload = fs.autoloads[i];

				let name = autoload.name;
				if (autoload.name !== 'ITCM' && autoload.name !== 'DTCM') name = 'al' + String(i);

				let addr = autoload.ramStart;
				// 02000000 - 02400000 and 02400000 - 02800000 are mirrors of each other
				if (0x02400000 <= addr && addr < 0x02800000) addr -= 0x00400000;
				addEntry(name, addr, autoload.ramSize, autoload.bssSize);
			}

			addEntry('ARM7', headers.arm7RamOffset, fs.arm7.byteLength, 0);

			for (let i = 0, o = headers.ovt9Offset; o < headers.ovt9Offset + headers.ovt9Length; ++i, o += 0x20) {
				const overlayU32 = bufToU32(sliceDataView(file, o, o + 0x20));
				addEntry(String(i), overlayU32[1], overlayU32[2], overlayU32[3]);
			}

			for (let i = 0, o = headers.ovt7Offset; o < headers.ovt7Offset + headers.ovt7Length; ++i, o += 0x20) {
				const overlayU32 = bufToU32(sliceDataView(file, o, o + 0x20));
				addEntry(String(i), overlayU32[1], overlayU32[2], overlayU32[3]);
			}

			preview.style.height = `${contentHeight}px`;
		};

		const updateOverlayEntries = () => {
			const str24 = x => x.toString(16).padStart(6, '0');
			const lines = [];

			const table = document.createElement('table');
			table.className = 'bordered';

			addHTML(
				table,
				`<tr>
					<th>ID</th>
					<th>RAM Region</th>
					<th>BSS Region</th>
					<th>Static Initializers</th>
					<th>Compressed?</th>
				</tr>`,
			);

			for (let i = 0, o = headers.ovt9Offset; o < headers.ovt9Offset + headers.ovt9Length; ++i, o += 0x20) {
				const dat = sliceDataView(file, o, o + 0x20);
				const [id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compression] = bufToU32(dat);

				let overlayDat;
				try {
					// maybe it is compressed using a different algorithm (for non-MLBIS games)
					overlayDat = fs.overlay(i, true);
				} catch (_) {}

				const columns = [];
				columns.push(`${i} (0x${i.toString(16)})`);
				columns.push(`${str32(ramStart)} - ${str32(ramStart + ramSize)}<br>len 0x${ramSize.toString(16)}`);

				if (bssSize) {
					columns.push(`${str32(ramStart + ramSize)} - ${str32(ramStart + ramSize + bssSize)}
						<br>len 0x${bssSize.toString(16)}`);
				} else {
					columns.push('-');
				}

				const staticInitializers = [];
				for (let o2 = staticStart; o2 < staticEnd; o2 += 4) {
					const pointed = overlayDat?.getUint32(o2 - ramStart, true);
					let note = '→ NULL';
					if (pointed) note = `→ FUN_${str32(pointed)}`;
					staticInitializers.push(`${str32(o2)} ${note}`);
				}
				columns.push(staticInitializers.join('<br>'));

				if (compression) {
					const compressionType = [, 'BLZ'][compression >> 24] ?? '?';
					columns.push(
						`${compression >> 24} (${compressionType})<br>len 0x${(compression & 0xffffff).toString(16)}`,
					);
				} else {
					columns.push('-');
				}

				addHTML(
					table,
					'<tr style="font-family: Red Hat Mono; text-align: center;">' +
						columns.map(x => '<td>' + x + '</td>').join('') +
						'</tr>',
				);
			}

			preview.appendChild(table);

			for (let i = 0, o = headers.ovt9Offset; o < headers.ovt9Offset + headers.ovt9Length; ++i, o += 0x20) {
				const dat = sliceDataView(file, o, o + 0x20);
				const str24 = x => x.toString(16).padStart(6, '0');

				const [id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, attributes] = bufToU32(dat);
				lines.push(
					`${String(id).padStart(4, '0')}` +
						` | ram ${str24(ramStart - 0x02000000)}-${str24(ramStart - 0x02000000 + ramSize)}` +
						` | static ${str24(staticStart - 0x02000000)}-${str24(staticEnd - 0x02000000)}` +
						` | bss ${str16(bssSize)} | attributes ${str32(attributes)} | size ${str32(ramSize)}`,
				);
			}

			const downloadContent = lines.join('\n');
			downloadButton.style.display = '';
			downloadCallback = () => download(`${headers.gamecode}-overlays.txt`, downloadContent);
		};

		const updateStringSearch = () => {
			const lines = [];
			const search = (label, dat) => {
				const found = [];
				const u8 = bufToU8(dat);

				let lastInvalid = -1;
				for (let o = 0; o < u8.length; ++o) {
					// valid characters: A-Z a-z 0-9 - _ . , /
					const byte = u8[o];
					const valid =
						(0x41 <= byte && byte <= 0x5a) ||
						(0x61 <= byte && byte <= 0x7a) ||
						(0x30 <= byte && byte <= 0x39) ||
						byte === 0x2d ||
						byte === 0x5f ||
						byte === 0x2e ||
						byte === 0x2c ||
						byte === 0x2f ||
						byte === 0x20;
					if (!valid) {
						const length = o - (lastInvalid + 1);
						if (length >= 6) found.push(latin1(lastInvalid + 1, length, dat));
						lastInvalid = o;
					}
				}

				lines.push(`${label}. ${found.join(', ')}`);
			};

			search('ARM9', fs.arm9);
			search('ARM7', fs.arm7);

			for (let i = 0; i * 0x20 < headers.ovt9Length; ++i) search(String(i).padStart(4, '0'), fs.overlay(i, true));

			const downloadContent = lines.join('\n');
			downloadButton.style.display = '';
			downloadCallback = () => download(`${headers.gamecode}-strings.txt`, downloadContent);

			preview.innerHTML = `<ul style="font-family: 'Red Hat Mono'">${lines.map(x => `<li>${x}</li>`).join('')}</ul>`;
		};

		const update = () => {
			preview.innerHTML = '';
			preview.style.height = '';
			downloadButton.style.display = 'none';

			if (mode.value === 0) updateRamArrangement();
			else if (mode.value === 1) updateOverlayEntries();
			else if (mode.value === 2) updateStringSearch();
		};
		update();

		return ovt;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: File System (Extended)                                                                               |
	// +---------------------------------------------------------------------------------------------------------------+

	const fsext = (window.fsext = createSection('File System (Extended)', section => {
		const fsext = {};

		const fixedIndices = (fsext.fixedIndices = (o, end, dat) => {
			const indices = [];
			for (; o < end; o += 4) indices.push(dat.getInt32(o, true));
			return indices;
		});

		const fixedSegments = (fsext.fixedSegments = (o, end, size, dat) => {
			const segments = [];
			for (; o < end; o += size) segments.push(sliceDataView(dat, o, o + size));
			return segments;
		});

		fsext.battle = new Map();
		fsext.battle.paths = [];

		const fillBattle = (ov, pathsAddr, numPaths, headersAddr, numHeaders) => {
			const dat = fs.overlay(ov.id);
			for (let i = 0; i < numPaths; ++i) {
				const pathOffset = dat.getUint32(pathsAddr - ov.ramStart + i * 4, true);
				if (!pathOffset) continue; // in the demo versions, some files like BMapG were removed

				const path = latin1(pathOffset - ov.ramStart, undefined, dat);
				fsext.battle.paths.push(path);

				let segments;
				if (i < numHeaders) {
					// segment table is stored inside the overlay
					const tableOffset = dat.getUint32(headersAddr - ov.ramStart + i * 4, true);
					segments = unpackSegmentedFile(dat, tableOffset - ov.ramStart, fs.get(path));
				} else {
					// segment table is stored inside the file
					segments = unpackSegmentedFile(fs.get(path), 0, fs.get(path));
				}

				fsext.battle.set(i, segments);
				fsext.battle.set(path, segments);
			}
		};

		if (headers.gamecode === 'CLJE') {
			// NA
			fillBattle(ovt.overlays[14], 0x0209caa4, 39, 0x0209c914, 20);

			const ov17 = fs.overlay(17);
			fsext.bdfxlib = sliceDataView(ov17, 0x020bbf30 - ovt.overlays[17].ramStart, ov17.byteLength);
			fsext.bdfxlib = unpackSegmentedFile(fsext.bdfxlib, 0, fsext.bdfxlib);
			fsext.blfx = sliceDataView(ov17, 0x020b8978 - ovt.overlays[17].ramStart, ov17.byteLength);
			fsext.blfx = unpackSegmentedFile(fsext.blfx, 0, fsext.blfx);
			fsext.bofxlib = sliceDataView(ov17, 0x020b8d68 - ovt.overlays[17].ramStart, ov17.byteLength);
			fsext.bofxlib = unpackSegmentedFile(fsext.bofxlib, 0, fsext.bofxlib);

			fsext.baiCommands = fixedSegments(0x13478, 0x156b8, 16, fs.overlay(12));
			fsext.bmapConfig = fixedSegments(0x0208fae0 - ovt.overlays[13].ramStart, 0x02090158 - ovt.overlays[13].ramStart, 9, fs.overlay(13));
			fsext.bmapSprites = bufToU32(sliceDataView(fs.overlay(13), 0x02090158 - ovt.overlays[13].ramStart, 0x02090438 - ovt.overlays[13].ramStart));
			fsext.monsters = fixedSegments(0xe074, 0xf448, 36, fs.overlay(11));

			fsext.fevent = unpackSegmentedFile(fs.overlay(3), 0xc8ac, fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = unpackSegmentedFile(fs.overlay(3), 0x11310, fs.get('/FMap/FMapData.dat'));
			fsext.fobj = unpackSegmentedFile(fs.overlay(3), 0xe8a0, fs.get('/FObj/FObj.dat'));
			// fsext.fobjmon = unpackSegmentedFile(fs.overlay(3), 0xba3c);
			// fsext.fobjpc = unpackSegmentedFile(fs.overlay(3), 0xbdb0);
			fsext.fpaf = unpackSegmentedFile(fs.overlay(3), 0xb8a0, fs.get('/FPaf/FPaf.dat'));

			fsext.fdfxpal = unpackSegmentedFile(fs.overlay(4), 0x4a82c, fs.get('/FRfx/FDfxPal.dat'));
			fsext.fdfxtex = unpackSegmentedFile(fs.overlay(4), 0x4a628, fs.get('/FRfx/FDfxTex.dat'));
			fsext.fofxpal = unpackSegmentedFile(fs.overlay(4), 0x4a4fc, fs.get('/FRfx/FOfxPal.dat'));
			fsext.fofxtex = unpackSegmentedFile(fs.overlay(4), 0x4a3d0, fs.get('/FRfx/FOfxTex.dat'));

			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fobjPalettes = fixedSegments(0x150c8, 0x15854, 4, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x43d3c, 0x464cc);
		} else if (headers.gamecode === 'CLJK') {
			// KO
			fillBattle(ovt.overlays[14], 0x0209caa4, 39, 0x0209c914, 20);

			fsext.baiCommands = fixedSegments(0x13478, 0x156b8, 16, fs.overlay(12));
			fsext.monsters = fixedSegments(0x17098, 0x1846c, 36, fs.overlay(11));

			fsext.fevent = unpackSegmentedFile(fs.overlay(3), 0xc8ac, fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = unpackSegmentedFile(fs.overlay(3), 0x11310, fs.get('/FMap/FMapData.dat'));
			fsext.fobj = unpackSegmentedFile(fs.overlay(3), 0xe8a0, fs.get('/FObj/FObj.dat'));
			// fsext.fobjmon = varLengthSegments(0xba3c, fs.overlay(3));
			// fsext.fobjpc = varLengthSegments(0xbdb0, fs.overlay(3));
			fsext.fpaf = unpackSegmentedFile(fs.overlay(3), 0xb8a0, fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x43d90, 0x462d8);
		} else if (headers.gamecode === 'CLJJ') {
			// JP/ROC
			fillBattle(ovt.overlays[11], 0x020bb460, 37, 0x020bb368, 20); // no BDfxAll or BOfxAll

			fsext.baiCommands = fixedSegments(0x41bc4, 0x43df0, 16, fs.overlay(11));
			fsext.monsters = fixedSegments(0x52cd4, 0x540a8, 36, fs.overlay(11));

			fsext.fevent = unpackSegmentedFile(fs.overlay(3), 0xcb18, fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = unpackSegmentedFile(fs.overlay(3), 0x11544, fs.get('/FMap/FMapData.dat'));
			fsext.fobj = unpackSegmentedFile(fs.overlay(3), 0xeb0c, fs.get('/FObj/FObj.dat'));
			// fsext.fobjmon = varLengthSegments(0xbca8, fs.overlay(3));
			// fsext.fobjpc = varLengthSegments(0xc01c, fs.overlay(3));
			fsext.fpaf = unpackSegmentedFile(fs.overlay(3), 0xbb0c, fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x9b00, 0x9b00 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x19710, 0x1a85c, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x1a85c, 0x1dd90, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x44fa8, 0x48084);
		} else if (headers.gamecode === 'CLJP') {
			// EU
			fillBattle(ovt.overlays[14], 0x0209caa4, 39, 0x0209c914, 20);

			fsext.baiCommands = fixedSegments(0x13478, 0x156b8, 16, fs.overlay(12));
			fsext.monsters = fixedSegments(0xe074, 0xf448, 36, fs.overlay(11));

			fsext.fevent = unpackSegmentedFile(fs.overlay(3), 0xc8ac, fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = unpackSegmentedFile(fs.overlay(3), 0x11310, fs.get('/FMap/FMapData.dat'));
			fsext.fobj = unpackSegmentedFile(fs.overlay(3), 0xe8a0, fs.get('/FObj/FObj.dat'));
			// fsext.fobjmon = varLengthSegments(0xba3c, fs.overlay(3));
			// fsext.fobjpc = varLengthSegments(0xbdb0, fs.overlay(3));
			fsext.fpaf = unpackSegmentedFile(fs.overlay(3), 0xb8a0, fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x43d3c, 0x464cc);
		} else if (headers.gamecode === 'Y6PP') {
			// EU Demo
			fillBattle(ovt.overlays[11], 0x020a8b2c, 37, 0x020a8a34, 20);

			fsext.baiCommands = fixedSegments(0x3a98c, 0x3cbbc, 16, fs.overlay(11));
			fsext.monsters = fixedSegments(0x478cc, 0x48c94, 36, fs.overlay(11));

			fsext.fevent = unpackSegmentedFile(fs.overlay(3), 0x94c8, fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = unpackSegmentedFile(fs.overlay(3), 0x9a3c, fs.get('/FMap/FMapData.dat'));
			fsext.fobj = unpackSegmentedFile(fs.overlay(3), 0x9cb0, fs.get('/FObj/FObj.dat'));
			// fsext.fobjmon = varLengthSegments(0x945c, fs.overlay(3));
			// fsext.fobjpc = varLengthSegments(0x97f8, fs.overlay(3));
			fsext.fpaf = unpackSegmentedFile(fs.overlay(3), 0x965c, fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x92bc, 0x92bc + 12 * 0x21, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0xe220, 0xe318, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0xe498, 0xe72c, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x406d0, 0x42e60);
		} else if (headers.gamecode === 'Y6PE') {
			// NA Demo
			fillBattle(ovt.overlays[11], 0x020a88cc, 37, 0x020a87d4, 20);

			fsext.baiCommands = fixedSegments(0x3a98c, 0x3cbbc, 16, fs.overlay(11));
			fsext.monsters = fixedSegments(0x4780c, 0x48be0, 36, fs.overlay(11));

			fsext.fevent = unpackSegmentedFile(fs.overlay(3), 0x94c8, fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = unpackSegmentedFile(fs.overlay(3), 0x9a3c, fs.get('/FMap/FMapData.dat'));
			fsext.fobj = unpackSegmentedFile(fs.overlay(3), 0x9cb0, fs.get('/FObj/FObj.dat'));
			// fsext.fobjmon = varLengthSegments(0x945c, fs.overlay(3));
			// fsext.fobjpc = varLengthSegments(0x97f8, fs.overlay(3));
			fsext.fpaf = unpackSegmentedFile(fs.overlay(3), 0x965c, fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x92bc, 0x92bc + 12 * 0x21, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0xe164, 0xe25c, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0xe3dc, 0xe670, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x4071c, 0x42cc8);
		} else {
			addHTML(section, `<b style="color: var(--red);">Unknown gamecode ${headers.gamecode}</b>`);
		}

		return fsext;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Rfx                                                                                                  |
	// +---------------------------------------------------------------------------------------------------------------+

	const rfx = (window.rfx = createSection('Rfx', section => {
		const rfx = {};

		const globalInvalidMatrices = rfx.globalInvalidMatrices = new WeakSet();

		// 1. Shared rfx functionality
		rfx.parse = dat => {
			const tracks = [];
			const rawSegments = unpackSegmented16(dat);
			for (let i = 0; i < rawSegments.length; ++i) {
				const u16 = bufToU16(rawSegments[i]);
				const s16 = bufToS16(rawSegments[i]);

				if (!u16.length) {
					tracks.push(undefined);
					continue;
				}

				const animLength = u16[0];
				const matrices = [];

				let o = 1;
				if (i !== rawSegments.length - 1) {
					while (o < u16.length) {
						const composite = u16[o];
						const opcode = composite & 0x3f;
						const rows = ((composite >> 6) & 7) + 2;
						const columns = (composite >> 9) + 2;
						if (o + rows * columns > u16.length) break;

						const matrix = [];
						for (let y = 0; y < rows; ++y) {
							const row = matrix[y] = [u16[o++]]; // first column is for control, should be unsigned
							for (let x = 1; x < columns; ++x) row[x] = s16[o++];
						}

						matrices.push(matrix);
					}
				}

				const leftover = sliceDataView(rawSegments[i], o * 2, rawSegments[i].byteLength);
				tracks.push({ animLength, matrices, leftover });
			}
			
			return tracks;
		};

		rfx.trackToHtml = ({ animLength, matrices, leftover }) => {
			const animLengthSpan = document.createElement('span');
			animLengthSpan.innerHTML = animLength;

			const parts = [animLengthSpan];

			for (const matrix of matrices) {
				const invalid = globalInvalidMatrices.has(matrix);
				const table = document.createElement('table');

				let tableStyle = `border: 1px solid var(${invalid ? '--red' : '--text'}); border-collapse: collapse;`;

				table.innerHTML = matrix.map((row, y) => '<tr>' + row.map((cell, x) => {
						if (x === 0) {
							if (y === 0) return `<td style="color: var(--blue); padding: 0 4px">${cell}</td>`;
							else return `<td style="color: var(--red); padding: 0 4px">${cell}</td>`;
						} else return `<td style="padding: 0 4px">${cell}</td>`;
					}).join('') + '</tr>').join('');

				if (matrix.header) {
					table.style.cssText = tableStyle;

					const container = document.createElement('div');
					container.style.cssText = 'display: inline-grid; grid-template-columns: 1fr; vertical-align: middle';

					const headerFlex = document.createElement('div');
					headerFlex.style.cssText = 'border: 1px solid var(--text); border-bottom: none; display: inline-flex; padding: 5px;';
					matrix.header.style.flexGrow = '1';

					headerFlex.appendChild(matrix.header);
					container.appendChild(headerFlex);
					container.appendChild(table);
					parts.push(container);
				} else {
					table.style.cssText = tableStyle + 'display: inline-table; vertical-align: middle';
					parts.push(table);
				}
			}

			if (leftover.byteLength) {
				const display = document.createElement('code');
				display.textContent = bytes(0, leftover.byteLength, leftover);
				parts.push(display);
			}

			return parts;
		};

		rfx.defaultDecorateMatrix = (matrix, ns) => {
			const composite = matrix[0][0];
			const opcode = composite & 0x3f;
			const rows = ((composite >> 6) & 7) + 2;
			const columns = (composite >> 9) + 2;

			matrix[0][0] = `${ns}_${str8(opcode)} (${rows}x${columns})`;

			for (let y = 1; y < matrix.length; ++y) {
				matrix[y][0] = str16(matrix[y][0]);
			}
		};

		rfx.defaultDecorateTrack = (track, ns) => {
			for (const matrix of track.matrices) {
				rfx.defaultDecorateMatrix(matrix, ns);
			}

			track.animLength = `(length = ${track.animLength})`;
		};

		rfx.keyframeIdx = (offsetChannel, tick, output) => {
			// if before the first keyframe's offset, return -1
			// if at or after the last keyframe:
			// - if its offset is 0, return its index
			// - otherwise, return -1
			output.idx = -1;
			output.tick = tick;

			for (let kfIdx = 0; kfIdx + 1 < offsetChannel.length; ++kfIdx) {
				const keyframeOffset = offsetChannel[1 + kfIdx];
				if (tick < keyframeOffset) return;

				output.idx = kfIdx;
				tick -= keyframeOffset;
				output.tick = tick;
			}

			if (offsetChannel[offsetChannel.length - 1]) output.idx = -1;
		};

		rfx.interpolateChannel = (offsetChannel, channel, keyframeIdx, keyframeTick) => {
			const mode = channel[0] >> 10;
			const duration = offsetChannel[2 + keyframeIdx];
			if (duration) {
				if (mode === 1) {
					// linear
					const from = channel[1 + keyframeIdx];
					const to = channel[2 + keyframeIdx];
					return from + (to - from) * keyframeTick / duration;
				}

				if (mode === 2) {
					// quadratic
					const from = channel[1 + keyframeIdx];
					const to = channel[2 + keyframeIdx];
					const alpha = keyframeTick / duration;
					const lerped = from + (to - from) * alpha;

					// TODO: not totally accurate due to rounding
					let before, after;
					if (keyframeIdx !== 0) {
						const previousDuration = offsetChannel[1 + keyframeIdx];
						before = from + (from - channel[0 + keyframeIdx]) * keyframeTick / previousDuration;
						before = (before + lerped) / 2; // average
					}

					if (keyframeIdx + 3 < channel.length) {
						const nextDuration = offsetChannel[3 + keyframeIdx];
						after = to + (channel[3 + keyframeIdx] - to) * keyframeTick / nextDuration;
						after = (after + lerped) / 2; // average
					}

					let beforeAlpha = alpha;
					let afterAlpha = 1 - alpha;
					if (before !== undefined && after !== undefined) {
						beforeAlpha *= beforeAlpha;
						afterAlpha *= afterAlpha;
					}

					return ((before ?? lerped) * beforeAlpha + (after ?? lerped) * afterAlpha) / (beforeAlpha + afterAlpha);
				}
			}

			// instant (mode 0, or other undefined mode, or duration 0)
			return channel[1 + keyframeIdx];
		};

		rfx.compile = tracks => {
			// 1. preprocess, find size of everything
			let size = 0;
			for (const { animLength, matrices, leftover } of tracks) {
				size += 2; // track ptr in header
				if (animLength !== undefined) size += 2;
				for (const matrix of matrices) size += 2 * matrix.length * matrix[0].length;
				size += leftover.byteLength;
			}

			// 2. compile everything
			const u16 = bufToU16(new DataView(new ArrayBuffer(size)));
			const s16 = bufToS16(u16);

			let o = tracks.length;
			for (let i = 0; i < tracks.length; ++i) {
				const { animLength, matrices, leftover } = tracks[i];
				u16[i] = o;

				if (animLength !== undefined) u16[o++] = animLength;
				for (const matrix of matrices) {
					const width = matrix[0].length;
					const opcode = matrix[0][0] & 0x3f;
					const control = opcode | ((matrix.length - 2) << 6) | ((width - 2) << 9);
					for (let y = 0; y < matrix.length; ++y) {
						if (matrix[y].length !== width) throw `matrix dimension mismatch on track ${i}`;
						for (let x = 0; x < matrix[0].length; ++x) {
							if (x === 0 && y === 0) u16[o++] = control;
							else s16[o++] = matrix[y][x];
						}
					}
				}

				if (leftover.byteLength) {
					u16.set(bufToU16(leftover), o);
					o += (leftover.byteLength >> 1);
				}
			}

			return bufToDat(u16);
		};

		// these color algorithms are equivalent to those in BIS (for valid inputs), except they are simplified since
		// the palette has already been converted to sRGB (rgb15To32) for performance reasons.
		const rgb15Lerp = (base, r, g, b, alpha) => {
			const baseR = (base >> 3) & 0x1f;
			const baseG = (base >> 11) & 0x1f;
			const baseB = (base >> 19) & 0x1f;
			const outR = (baseR * (32 - alpha) + r * alpha) >> 5;
			const outG = (baseG * (32 - alpha) + g * alpha) >> 5;
			const outB = (baseB * (32 - alpha) + b * alpha) >> 5;

			const outRGB = (outB << 16) | (outG << 8) | outR;
			return 0xff000000 | (outRGB << 3) | ((outRGB & 0x181818) >> 2);
		};

		const rgb15Add = (base, r, g, b, alpha) => {
			const baseR = (base >> 3) & 0x1f;
			const baseG = (base >> 11) & 0x1f;
			const baseB = (base >> 19) & 0x1f;
			const outR = Math.min(baseR + ((r * alpha) >> 5), 0x1f);
			const outG = Math.min(baseG + ((g * alpha) >> 5), 0x1f);
			const outB = Math.min(baseB + ((b * alpha) >> 5), 0x1f);

			const outRGB = (outB << 16) | (outG << 8) | outR; // 00000000_000bbbbb_000ggggg_000rrrrr
			return 0xff000000 | (outRGB << 3) | ((outRGB & 0x1c1c1c) >> 2);
		};

		const rgb15Sub = (base, r, g, b, alpha) => {
			const baseR = (base >> 3) & 0x1f;
			const baseG = (base >> 11) & 0x1f;
			const baseB = (base >> 19) & 0x1f;
			const outR = Math.max(baseR - ((r * alpha) >> 5), 0);
			const outG = Math.max(baseG - ((g * alpha) >> 5), 0);
			const outB = Math.max(baseB - ((b * alpha) >> 5), 0);

			const outRGB = (outB << 16) | (outG << 8) | outR;
			return 0xff000000 | (outRGB << 3) | ((outRGB & 0x181818) >> 2);
		};

		const rgb15Tint = (base, r, g, b, alpha) => {
			const baseR = (base >> 3) & 0x1f;
			const baseG = (base >> 11) & 0x1f;
			const baseB = (base >> 19) & 0x1f;
			const luminance = Math.min((baseR + baseG + baseB) >> 1, 0x1f);

			const outR = (baseR * (32 - alpha) + (((r * luminance) >> 5) * alpha)) >> 5;
			const outG = (baseG * (32 - alpha) + (((g * luminance) >> 5) * alpha)) >> 5;
			const outB = (baseB * (32 - alpha) + (((b * luminance) >> 5) * alpha)) >> 5;

			const outRGB = (outB << 16) | (outG << 8) | outR;
			return 0xff000000 | (outRGB << 3) | ((outRGB & 0x181818) >> 2);
		};

		const rgb15Invert = (base, alpha) => {
			const baseR = (base >> 3) & 0x1f;
			const baseG = (base >> 11) & 0x1f;
			const baseB = (base >> 19) & 0x1f;
			const outR = (baseR * (32 - alpha) + (32 - baseR) * alpha) >> 5;
			const outG = (baseG * (32 - alpha) + (32 - baseG) * alpha) >> 5;
			const outB = (baseB * (32 - alpha) + (32 - baseB) * alpha) >> 5;

			const outRGB = (outB << 16) | (outG << 8) | outR;
			return 0xff000000 | (outRGB << 3) | ((outRGB & 0x181818) >> 2);
		};

		// 2. Per-dialect rfx functionality
		rfx.bafDecorateTrack = track => {
			// Baf does not use the animation length field, but it still contains valuable information
			track.animLength = `<code>${str16(track.animLength)}</code>`;

			for (const matrix of track.matrices) {
				const opcode = matrix[0][0] & 0x3f;
				if (opcode === 0) {
					matrix[0][0] = 'keyframes';
					matrix[1][0] = 'length';
				} else if (opcode === 1) {
					matrix[0][0] = 'dst';
					matrix[0][1] = '0x' + matrix[0][1].toString(16);
					matrix[1][0] = 'size';
					matrix[1][1] = '0x' + matrix[1][1].toString(16);
					matrix[2][0] = 'src';
					matrix[2][1] = '0x' + matrix[2][1].toString(16);
				}
			}
		};

		rfx.pafApply = (palette, tracks, tick) => {
			const track = tracks?.[0];
			if (!track) return;

			const keyframe = { idx: -1, tick: 0 };

			let src = 0, size = 0, dst = 0; // palette
			let red = 0, green = 0, blue = 0; // kf_color
			for (const matrix of track.matrices) {
				const opcode = matrix[0][0] & 0x3f;
				if (opcode === 2) {
					// palette
					dst = matrix[1][1];
					size = matrix[2][1];
					src = matrix[3][1];

					// these fixes (which ensure no out-of-bound read/writes are done) are always done when applying
					// changes, so might as well fix them now
					if (palette.length - dst < size) size = palette.length - dst;
					if (palette.length - src < size) size = palette.length - src;
				} else if (opcode === 3) {
					// kf_color
					let redRow, greenRow, blueRow;
					for (let y = 1; y < matrix.length; ++y) {
						const field = matrix[y][0] & 0x3ff;
						const mode = matrix[y][0] >> 10;

						if (field === 0x1c) redRow = matrix[y];
						else if (field === 0x1d) greenRow = matrix[y];
						else if (field === 0x1e) blueRow = matrix[y];
					}

					if (!redRow || !greenRow || !blueRow) continue;

					rfx.keyframeIdx(matrix[0], tick % track.animLength, keyframe);
					if (keyframe.idx !== -1) {
						red = rfx.interpolateChannel(matrix[0], redRow, keyframe.idx, keyframe.tick) | 0;
						green = rfx.interpolateChannel(matrix[0], greenRow, keyframe.idx, keyframe.tick) | 0;
						blue = rfx.interpolateChannel(matrix[0], blueRow, keyframe.idx, keyframe.tick) | 0;
					}
				} else if (opcode === 4) {
					// kf_rotate
					rfx.keyframeIdx(matrix[0], tick % track.animLength, keyframe);
					if (keyframe.idx !== -1) {
						const value = rfx.interpolateChannel(matrix[0], matrix[1], keyframe.idx, keyframe.tick);
						const shift = ((value * size / 100) + 0.5) | 0;
						const original = new Uint32Array(size);

						original.set(palette.slice(src, src + size));
						palette.set(original.slice(shift), dst);
						palette.set(original.slice(0, shift), dst + size - shift);
					}
				} else if (5 <= opcode && opcode <= 8) {
					// kf_set, kf_add, kf_sub, kf_tint
					rfx.keyframeIdx(matrix[0], tick % track.animLength, keyframe);
					if (keyframe.idx !== -1) {
						const value = rfx.interpolateChannel(matrix[0], matrix[1], keyframe.idx, keyframe.tick);
						const alpha = ((value * 32 / 100) + 0.5) | 0;

						const blendFn = [rgb15Lerp, rgb15Add, rgb15Sub, rgb15Tint][opcode - 5];

						if (src >= dst) {
							// write from left-to-right
							for (let i = 0; i < size; ++i) {
								palette[dst + i] = blendFn(palette[src + i], red, green, blue, alpha);
							}
						} else {
							// write from right-to-left
							for (let i = size - 1; i >= 0; --i) {
								palette[dst + i] = blendFn(palette[src + i], red, green, blue, alpha);
							}
						}
					}
				} else if (opcode === 9) {
					// kf_invert
					rfx.keyframeIdx(matrix[0], tick % track.animLength, keyframe);
					if (keyframe.idx !== -1) {
						const value = rfx.interpolateChannel(matrix[0], matrix[1], keyframe.idx, keyframe.tick);
						const alpha = ((value * 32 / 100) + 0.5) | 0;

						if (src >= dst) {
							// write from left-to-right
							for (let i = 0; i < size; ++i) {
								palette[dst + i] = rgb15Invert(palette[src + i], alpha);
							}
						} else {
							// write from right-to-left
							for (let i = size - 1; i >= 0; --i) {
								palette[dst + i] = rgb15Invert(palette[src + i], alpha);
							}
						}
					}
				} else if (opcode === 0xa) {
					// kf_crossfade
					rfx.keyframeIdx(matrix[0], tick % track.animLength, keyframe);
					if (keyframe.idx !== -1) {
						const srcFrom = matrix[1][1 + keyframe.idx];
						const duration = matrix[0][1 + keyframe.idx];

						let sizeFixed = size;
						if (palette.length - srcFrom < sizeFixed) sizeFixed = palette.length - srcFrom;

						if (2 + keyframe.idx < matrix[1].length && duration) {
							const srcTo = matrix[1][2 + keyframe.idx];
							if (palette.length - srcTo < sizeFixed) sizeFixed = palette.length - srcTo;

							const lerped = new Uint32Array(sizeFixed);
							for (let i = 0; i < sizeFixed; ++i) {
								const r = (palette[srcTo + i] >> 3) & 0x1f;
								const g = (palette[srcTo + i] >> 11) & 0x1f;
								const b = (palette[srcTo + i] >> 19) & 0x1f;
								lerped[i] = rgb15Lerp(palette[srcFrom], r, g, b, (keyframe.tick * 32 / duration) | 0);
							}

							palette.set(lerped, dst);
						} else {
							palette.set(palette.slice(srcFrom, srcFrom + sizeFixed), dst);
						}
					}
				}
			}
		};

		rfx.pafDecorateTrack = track => {
			const animLength = track.animLength;
			track.animLength = `(length = ${track.animLength})`;

			for (const matrix of track.matrices) {
				const opcode = matrix[0][0] & 0x3f;
				if (opcode === 2) {
					matrix[0][0] = 'palette';
					matrix[1][0] = 'dst';
					matrix[1][1] = '0x' + str8(matrix[1][1]);
					matrix[2][0] = 'size';
					matrix[2][1] = '0x' + str8(matrix[2][1]);
					matrix[3][0] = 'src';
					matrix[3][1] = '0x' + str8(matrix[3][1]);
				} else if (opcode === 3) {
					matrix[0][0] = 'kf_color';

					let redRow, greenRow, blueRow;
					for (let y = 1; y < matrix.length; ++y) {
						const field = matrix[y][0] & 0x3ff;
						if (field === 0x1c) redRow = matrix[y];
						else if (field === 0x1d) greenRow = matrix[y];
						else if (field === 0x1e) blueRow = matrix[y];
					}

					if (redRow && greenRow && blueRow && animLength && animLength < 1000) {
						const graph = document.createElement('canvas');
						graph.style.cssText = `width: 0; height: 10px`;
						graph.width = animLength;
						graph.height = 1;

						const bitmap = new Uint32Array(animLength);
						let startTick = matrix[0][1];

						for (let kf = 0; 1 + kf < matrix[0].length - 1; ++kf) {
							const duration = matrix[0][2 + kf];
							const endTick = startTick + duration;

							for (let tick = startTick, i = 0; tick < endTick; ++tick, ++i) {
								let r = rfx.interpolateChannel(matrix[0], redRow, kf, i) | 0;
								let g = rfx.interpolateChannel(matrix[0], greenRow, kf, i) | 0;
								let b = rfx.interpolateChannel(matrix[0], blueRow, kf, i) | 0;

								r = (r << 3) | (r >> 2);
								g = (g << 3) | (g >> 2);
								b = (b << 3) | (b >> 2);
								bitmap[tick] = 0xff000000 | (b << 16) | (g << 8) | r;
							}

							startTick = endTick;
						}

						// fill the rest of the graph with the last color
						const end = matrix[0].length - 1;
						const lastR = (redRow[end] << 3) | (redRow[end] >> 2);
						const lastG = (greenRow[end] << 3) | (greenRow[end] >> 2);
						const lastB = (blueRow[end] << 3) | (blueRow[end] >> 2);
						const lastColor = 0xff000000 | (lastB << 16) | (lastG << 8) | lastR;
						bitmap.fill(lastColor, startTick, animLength);

						const ctx = graph.getContext('2d');
						ctx.putImageData(new ImageData(bufToU8Clamped(bitmap), animLength, 1), 0, 0);

						matrix.header = graph;
					}

					for (let y = 1; y < matrix.length; ++y) {
						const field = matrix[y][0] & 0x3ff;
						const mode = matrix[y][0] >> 10;

						let fieldStr, modeStr;
						if (matrix[y] === redRow) fieldStr = 'red';
						else if (matrix[y] === greenRow) fieldStr = 'green';
						else if (matrix[y] === blueRow) fieldStr = 'blue';

						if (mode === 0) modeStr = '(instant)';
						else if (mode === 1) modeStr = ''; // 'linear' is used like 99.9% of the time, no need to show
						else modeStr = '(' + String(mode) + ')';

						if (fieldStr) matrix[y][0] = fieldStr + modeStr;
						else matrix[y][0] = str16(matrix[y][0]);
					}
				} else if (4 <= opcode && opcode <= 9) {
					matrix[0][0] = ['kf_rotate', 'kf_set', 'kf_add', 'kf_sub', 'kf_tint', 'kf_invert'][opcode - 4];

					if (animLength && animLength < 1000) {
						const graph = document.createElement('canvas');
						graph.style.cssText = `width: 0; height: 50px`;
						graph.width = animLength;
						graph.height = 100;

						const bitmap = new Uint32Array(animLength * 100);
						let startTick = matrix[0][1];
						for (let kf = 0; 1 + kf < matrix[0].length - 1; ++kf) {
							const duration = matrix[0][2 + kf];
							const endTick = startTick + duration;

							for (let tick = startTick, i = 0; tick < endTick; ++tick, ++i) {
								const a = rfx.interpolateChannel(matrix[0], matrix[1], kf, i);

								const colorA = Math.min(a, 100) / 100 * 127 + 128;
								const color = 0xff000000 | (colorA << 16) | (colorA << 8) | colorA;
								for (let y = 100 - (a | 0); y < 100; ++y) {
									bitmap[y * animLength + tick] = color;
								}
							}

							startTick = endTick;
						}

						const ctx = graph.getContext('2d');
						ctx.putImageData(new ImageData(bufToU8Clamped(bitmap), animLength, 100), 0, 0);

						matrix.header = graph;
					}

					const mode = matrix[1][0] >> 10;
					matrix[1][0] = '%';
				} else if (opcode === 0xa) {
					matrix[0][0] = 'kf_crossfade';
					matrix[1][0] = 'dst';
					for (let x = 1; x < matrix[1].length; ++x) {
						matrix[1][x] = '0x' + str8(matrix[1][x]);
					}
				} else {
					rfx.defaultDecorateMatrix(matrix, 'PAF');
				}
			}
		};

		const genericParameters = new Map([
			// alpha multiplier (<< 8)
			[0x00, 'move_x'],
			[0x01, 'move_y'],
			[0x02, 'move_z'],
			[0x03, 'scale_x'],
			[0x04, 'scale_y'],
			[0x05, 'scale_z'],
			[0x06, 'rot_x'],
			[0x07, 'rot_y'],
			[0x08, 'rot_z'],
			[0x09, 'scale_x_by_x'],
			[0x0a, 'scale_x_by_y'],
			[0x0b, 'scale_x_by_z'],
			[0x0c, 'scale_y_by_x'],
			[0x0d, 'scale_y_by_y'],
			[0x0e, 'scale_y_by_z'],
			[0x0f, 'scale_z_by_x'],
			[0x10, 'scale_z_by_y'],
			[0x11, 'scale_z_by_z'],

			// raw matrix set (<< 4 or >> 12)
			[0x19, 'mtx_11'],
			[0x1a, 'mtx_11_frac'],
			[0x1b, 'mtx_12'],
			[0x1c, 'mtx_12_frac'],
			[0x1d, 'mtx_13'],
			[0x1e, 'mtx_13_frac'],
			[0x1f, 'mtx_21'],
			[0x20, 'mtx_21_frac'],
			[0x21, 'mtx_22'],
			[0x22, 'mtx_22_frac'],
			[0x23, 'mtx_23'],
			[0x24, 'mtx_23_frac'],
			[0x25, 'mtx_31'],
			[0x26, 'mtx_31_frac'],
			[0x27, 'mtx_32'],
			[0x28, 'mtx_32_frac'],
			[0x29, 'mtx_33'],
			[0x2a, 'mtx_33_frac'],
			[0x2b, 'mtx_41'],
			[0x2c, 'mtx_41_frac'],
			[0x2d, 'mtx_42'],
			[0x2e, 'mtx_42_frac'],
			[0x2f, 'mtx_43'],
			[0x30, 'mtx_43_frac'],

			// parameters
			[0x39, 'x'],
			[0x3a, 'y'],
			[0x3b, 'z'],
			[0x3c, 'red'],
			[0x3d, 'green'],
			[0x3e, 'blue'],
			[0x3f, 'custom1'],
			[0x40, 'custom2'],
			[0x41, 'custom3'],
			[0x42, 'custom4'],
			[0x43, 'palette_row'],
			[0x44, 'transparency'],
		]);
		rfx.decorateStateRow = row => {
			const easing = row[0] >> 10;
			let easingStr;
			if (easing === 0) easingStr = '=';
			else if (easing === 1) easingStr = '/';
			else if (easing === 2) easingStr = '~';
			else easingStr = String(easing);

			const param = row[0] & 0x3ff;
			const paramStr = genericParameters.get(param) ?? str8(param);

			if (0 <= param && param <= 0x11) {
				for (let x = 1; x < row.length; ++x) {
					const val = row[x] / 256;
					if (Number.isInteger(val)) row[x] = String(val) + '.0';
					else row[x] = String(val);
				}
			} else if (0x19 <= param && param <= 0x30) {
				// unknown for now
				row[x] = '0x' + row[x].toString(16);
			}

			easingStr = '(' + easingStr + ') ';
			if (row.length <= 2) easingStr = ''; // hide it
			row[0] = `${easingStr}${paramStr}`;
		};

		rfx.dfxDecorateTrack = track => {
			const animLength = track.animLength;
			track.animLength = `(length = ${track.animLength})`;

			for (const matrix of track.matrices) {
				const control = matrix[0][0];
				const opcode = control & 0x3f;
				if (opcode === 0x00) {
					matrix[0][0] = 'triangle_strip';
					for (let y = 1; y < matrix.length; ++y) rfx.decorateStateRow(matrix[y]);
				} else if (opcode === 0x0a) {
					matrix[0][0] = 'transform_target';
					for (let y = 1; y < matrix.length; ++y) rfx.decorateStateRow(matrix[y]);
				} else if (opcode === 0x0b) {
					matrix[0][0] = 'blend_target';
					for (let y = 1; y < matrix.length; ++y) {
						const param = matrix[y][0];
						const mode = ['=', '/', '~'][param >> 10] ?? String(mode);
						const blendFunc = ['lerp', 'add', 'sub', 'tint'][param & 3];
						const fullPalette = !!(param & 0x10);
						matrix[y][0] = `(${mode}) ${blendFunc}${fullPalette ? '+' : ''}`;

						for (let x = 1; x < matrix[y].length; ++x) matrix[y][x] = String(matrix[y][x]) + '%';
					}
				} else if (0x24 <= opcode && opcode <= 0x2d) {
					matrix[0][0] = `setup (${str8(opcode)})`;
					for (let y = 1; y < matrix.length; ++y) rfx.decorateStateRow(matrix[y]);
				} else if (opcode === 0x34) {
					// subtrack call: last row is the track id
					matrix[0][0] = 'subtrack';

					for (let y = 1; y < matrix.length - 1; ++y) rfx.decorateStateRow(matrix[y]);

					const bottomControl = matrix[matrix.length - 1][0];
					matrix[matrix.length - 1][0] = `track ${bottomControl === 1 ? '(reset mtx)' : ''}`;
				} else if (opcode === 0x37) {
					// alt track call: last row is the track id
					matrix[0][0] = 'libtrack';

					for (let y = 1; y < matrix.length - 1; ++y) rfx.decorateStateRow(matrix[y]);

					const bottomControl = matrix[matrix.length - 1][0];
					matrix[matrix.length - 1][0] = `track ${bottomControl === 1 ? '(reset mtx)' : ''}`;
				} else {
					rfx.defaultDecorateMatrix(matrix, 'DFX');
				}
			}
		};

		return rfx;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Field Palette Animations                                                                             |
	// +---------------------------------------------------------------------------------------------------------------+

	const fpaf = (window.fpaf = createSection('Field Palette Animations', section => {
		const fpaf = {};

		const customNames = checkbox('Custom Names', true, () => update());
		section.appendChild(customNames);

		const show = button('Show', () => update());
		section.appendChild(show);

		const table = document.createElement('table');
		table.className = 'bordered';
		section.appendChild(table);

		const update = () => {
			show.remove();
			table.innerHTML = '';
			for (let i = 0; i < fsext.fpaf.length - 1; ++i) {
				const tracks = rfx.parse(fsext.fpaf[i]);

				const parts = [];
				for (let j = 0; j < tracks.length; ++j) {
					const track = tracks[j];
					if (!track) {
						parts.push(`<div style="padding: 2px 0"><code>[${j}]</code> (empty)</div>`);
						continue;
					}

					if (customNames.checked) rfx.pafDecorateTrack(track);
					else rfx.defaultDecorateTrack(track, 'PAF');

					let style = 'padding: 2px 0;';
					if (j === tracks.length - 1) style += 'color: var(--fg-dim)'; // the last track isn't relevant

					const div = document.createElement('div');
					div.style.cssText = style;

					addHTML(div, `<code>[${j}]</code>`);
					for (const el of rfx.trackToHtml(track)) {
						addHTML(div, ' ');
						div.appendChild(el);
					}

					parts.push(div);
				}

				const tr = document.createElement('tr');
				addHTML(tr, `<th>${i}</th>`);

				const td = document.createElement('td');
				for (const part of parts) td.appendChild(part);

				tr.appendChild(td);
				table.appendChild(tr);
			}
		};

		return fpaf;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Field Maps                                                                                           |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initField) await waitFor(() => window.initField);
	window.initField();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: FMapData Tile Viewer                                                                                 |
	// +---------------------------------------------------------------------------------------------------------------+

	const fmapdataTiles = (window.fmapdataTiles = createSection('FMapData Tile Viewer', section => {
		const fmapdataTiles = {};
		const fieldFile = fs.get('/FMap/FMapData.dat');

		const options = [];
		for (let i = 0; i < fsext.fieldAnimeIndices[0]; ++i) options.push(`FMapData ${i.toString(16)}`);
		for (let i = 0; i < fsext.fieldAnimeIndices.length; ++i)
			options.push(`FMapData ${fsext.fieldAnimeIndices[i].toString(16)} (Anime ${i.toString(16)})`);
		const select = dropdown(options, 0, () => update());

		section.appendChild(select);

		const dump = document.createElement('button');
		dump.textContent = 'Dump';
		dump.addEventListener('click', () => {
			const index = select.value;
			const data = lzBis(fsext.fmapdata[index]);
			download(`FMapData-${index.toString(16)}.bin`, data.buffer);
		});
		section.appendChild(dump);

		// generate a rainbow color palette, with later values using darker colors (0 - 0xf instead of 0 - 0x1f)
		const globalPalette256 = (fmapdataTiles.globalPalette256 = new DataView(new ArrayBuffer(512)));
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(i * 2, (0x1f << 10) | (i << 5) | 0, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0x40 + i * 2, (i << 10) | (0x1f << 5) | 0, true);
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(0x80 + i * 2, (0 << 10) | (0x1f << 5) | i, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0xc0 + i * 2, (0 << 10) | (i << 5) | 0x1f, true);
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(0x100 + i * 2, (i << 10) | (0 << 5) | 0x1f, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0x140 + i * 2, (0x1f << 10) | (0 << 5) | i, true);
		for (let i = 0; i < 16; ++i) globalPalette256.setUint16(0x180 + i * 2, (0xf << 10) | (i << 5) | 0, true);
		for (let i = 15; i >= 0; --i) globalPalette256.setUint16(0x1a0 + i * 2, (i << 10) | (0xf << 5) | 0, true);
		for (let i = 0; i < 16; ++i) globalPalette256.setUint16(0x1c0 + i * 2, 0 | (0xf << 5) | i, true);
		for (let i = 15; i >= 0; --i) globalPalette256.setUint16(0x1e0 + i * 2, 0 | (i << 5) | 0xf, true);

		const globalPalette16 = (fmapdataTiles.globalPalette16 = new DataView(new ArrayBuffer(512)));
		const rgb15s = [
			[31, 0, 0],
			[31, 10, 0],
			[31, 20, 0],
			[31, 31, 0],
			[20, 31, 0],
			[10, 31, 0],
			[0, 31, 0],
			[0, 31, 10],
			[0, 31, 20],
			[0, 31, 31],
			[0, 20, 31],
			[0, 10, 31],
			[0, 0, 31],
			[10, 0, 31],
			[20, 0, 31],
			[31, 0, 31],
		];
		for (let i = 0; i < 16; ++i) {
			const [b, g, r] = rgb15s[i];
			const rgb15 = (r << 10) | (g << 5) | b;
			for (let o = 0; o < 512; o += 32) globalPalette16.setUint16(o + i * 2, rgb15, true);
		}

		let paletteSelectPlaceholder = document.createElement('button');
		paletteSelectPlaceholder.textContent = 'Find Palettes';
		section.appendChild(paletteSelectPlaceholder);

		const canvasContainer = document.createElement('div');
		canvasContainer.style.cssText = 'height: 640px; position: relative;';
		section.appendChild(canvasContainer);

		const tileCanvases256 = [];
		const tileCanvases16 = [];
		const paletteCanvases = [];
		for (let i = 0; i < 3; ++i) {
			const tc256 = document.createElement('canvas');
			tc256.width = tc256.height = 256;
			tc256.style.cssText = `position: absolute; top: 0px; left: ${i * 256}px; width: 256px; height: 256px;`;
			canvasContainer.appendChild(tc256);
			tileCanvases256.push(tc256);

			const tc16 = document.createElement('canvas');
			tc16.width = tc16.height = 256;
			tc16.style.cssText = `position: absolute; top: 256px; left: ${i * 256}px; width: 256px; height: 256px;`;
			canvasContainer.appendChild(tc16);
			tileCanvases16.push(tc16);
		}

		for (let i = 0; i < 6; ++i) {
			const pc = document.createElement('canvas');
			pc.width = pc.height = 16;
			pc.style.cssText = `position: absolute; top: 512px; left: ${i * 128}px; width: 128px; height: 128px;`;
			canvasContainer.appendChild(pc);
			paletteCanvases.push(pc);
		}

		const animeToProps = (fmapdataTiles.animeToProps = new Map());
		paletteSelectPlaceholder.addEventListener('mousedown', () => {
			for (let i = 0; i < field.rooms.length; ++i) {
				const props = unpackSegmented32(lzBis(fsext.fmapdata[field.rooms[i].props]));
				const passiveAnimations = unpackSegmented32(props[10]);
				for (const passiveAnime of passiveAnimations) {
					const tileset = passiveAnime.getInt16(4, true);
					let arr = animeToProps.get(tileset) || [];
					arr.push(i);
					animeToProps.set(tileset, arr);
				}
			}
			update();
		});

		let paletteOptions = [];
		const update = () => {
			const animeId = select.value - fsext.fieldAnimeIndices[0];
			if (animeToProps.size) {
				if (animeId >= 0) {
					paletteOptions = animeToProps.get(animeId) || [];

					if (paletteOptions.length === 0) {
						const span = document.createElement('span');
						span.textContent = '(unused?)';
						paletteSelectPlaceholder.replaceWith(span);
						paletteSelectPlaceholder = span;
					} else {
						const select = dropdown(
							paletteOptions.map(x => `Palette for Room 0x${x.toString(16)}`),
							0,
							() => render(),
						);
						paletteSelectPlaceholder.replaceWith(select);
						paletteSelectPlaceholder = select;
					}
				} else {
					paletteOptions = [];
					const placeholder = document.createElement('span');
					placeholder.textContent = '(global palette)';
					paletteSelectPlaceholder.replaceWith(placeholder);
					paletteSelectPlaceholder = placeholder;
				}
			}

			render();
		};

		const render = () => {
			const index = select.value;
			const data = lzBis(fsext.fmapdata[index]);

			let palettes = [
				globalPalette256,
				globalPalette16,
				globalPalette256,
				globalPalette16,
				globalPalette256,
				globalPalette16,
			];
			if (paletteOptions.length) {
				const roomIndex = paletteOptions[paletteSelectPlaceholder.value];
				const room = field.rooms[roomIndex];
				const props = unpackSegmented32(lzBis(fsext.fmapdata[room.props]));
				palettes = [props[3], props[3], props[4], props[4], props[5], props[5]];
			}

			// 256-color
			const bitmap256 = new Uint8ClampedArray(256 * 256 * 4);
			for (let i = 0; i < 3; ++i) {
				const ctx = tileCanvases256[i].getContext('2d');
				if (palettes[i * 2].byteLength !== 512) {
					// if the layer doesn't exist in the room
					ctx.clearRect(0, 0, 256, 256);
					continue;
				}

				let o = 0;
				for (let j = 0; o < data.byteLength; ++j) {
					const basePos = ((j >> 5) << 11) | ((j & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
					for (let k = 0; k < 64 && o < data.byteLength; ++k) {
						const pos = basePos | ((k >> 3) << 8) | (k & 0x7);
						const paletteIndex = data.getUint8(o++);
						writeRgb16(bitmap256, pos, palettes[i * 2].getUint16(paletteIndex * 2, true));
					}
				}

				ctx.putImageData(new ImageData(bitmap256, 256, 256), 0, 0);
			}

			// 16-color
			const bitmap16 = new Uint8ClampedArray(256 * 256 * 4);
			for (let i = 0; i < 3; ++i) {
				const ctx = tileCanvases16[i].getContext('2d');
				if (palettes[i * 2 + 1].byteLength !== 512) {
					// if the layer doesn't exist in the room
					ctx.clearRect(0, 0, 256, 256);
					continue;
				}

				let o = 0;
				for (let j = 0; o < data.byteLength; ++j) {
					const basePos = ((j >> 5) << 11) | ((j & 0x1f) << 3); // y = j >> 5, x = j & 0x1f
					for (let k = 0; k < 64 && o < data.byteLength; k += 2) {
						const pos = basePos | ((k >> 3) << 8) | (k & 0x7);
						const composite = data.getUint8(o++);
						writeRgb16(bitmap16, pos, palettes[i * 2 + 1].getUint16((composite & 0xf) * 2, true));
						writeRgb16(bitmap16, pos ^ 1, palettes[i * 2 + 1].getUint16((composite >> 4) * 2, true));
					}
				}

				ctx.putImageData(new ImageData(bitmap16, 256, 256), 0, 0);
			}

			// palettes
			const bitmapPal = new Uint8ClampedArray(256 * 4);
			for (let i = 0; i < 6; ++i) {
				const ctx = paletteCanvases[i].getContext('2d');
				if (palettes[i].byteLength !== 512) {
					ctx.clearRect(0, 0, 16, 16);
					continue;
				}

				for (let j = 0; j < 256; ++j) writeRgb16(bitmapPal, j, palettes[i].getUint16(j * 2, true));
				ctx.putImageData(new ImageData(bitmapPal, 16, 16), 0, 0);
			}
		};
		update();

		return fmapdataTiles;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Battle Maps                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const battle = (window.battle = createSection('Battle Maps', section => {
		const battle = {};

		const bmap = (battle.bmap = unpackSegmentedFile(fs.get('/BMap/BMap.dat'), 0, fs.get('/BMap/BMap.dat')));

		const bmaps = (battle.bmaps = []);
		for (let i = 0; i < bmap.length; i += 8) {
			bmaps.push({
				tileset: bmap[i],
				palette: bmap[i + 1],
				tilemaps: [bmap[i + 2], bmap[i + 3], bmap[i + 4]],
				paletteAnimations: bmap[i + 5],
				bgAnimations: bmap[i + 6],
				tilesetAnimated: bmap[i + 7],
			});
		}

		const bmapDropdown = dropdown(
			bmaps.map((_, i) => `BMap 0x${i.toString(16)} (0x${(i * 8).toString(16)})`),
			0,
			() => update(),
		);
		section.appendChild(bmapDropdown);

		let updatePalette = false;
		let updateTileset = false;
		let updateTilesetAnimated = false;
		let updateMap = false;

		const options = {};
		options.bgChecks = [];
		section.appendChild(
			(options.bgChecks[0] = checkbox('BG1', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.bgChecks[1] = checkbox('BG2', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.bgChecks[2] = checkbox('BG3', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.margins = checkbox('Margins', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			button('Export PNG', () => {
				const pngFile = battle.png(
					bmapDropdown.value,
					options.bgChecks[0].checked,
					options.bgChecks[1].checked,
					options.bgChecks[2].checked,
					options.margins.checked,
				);
				download(`bmap-${str16(bmapDropdown.value)}.png`, pngFile, 'image/png');
			}),
		);
		section.appendChild((options.palette = checkbox('Palette', false, () => updatePreviewLayout())));
		section.appendChild((options.tilesets = checkbox('Tilesets', false, () => updatePreviewLayout())));
		section.appendChild(
			(options.autoscroll = checkbox('Autoscroll', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.paletteAnimations = checkbox('Palette Animations', true, () => {
				updatePalette = updateTileset = updateTilesetAnimated = updateMap = true;
			})),
		);
		section.appendChild(
			(options.bgAnimations = checkbox('BG Animations', true, () => {
				updateTileset = updateMap = true;
			})),
		);

		const preview = document.createElement('div');
		preview.style.cssText = 'position: relative;';
		section.appendChild(preview);

		const mapCanvas = document.createElement('canvas');
		mapCanvas.width = 512;
		mapCanvas.height = 256;
		preview.appendChild(mapCanvas);

		const raws = document.createElement('div');
		raws.style.cssText = 'height: 256px; position: relative; display: none;';
		preview.appendChild(raws);

		const tilesetCanvas = document.createElement('canvas');
		tilesetCanvas.style.cssText = 'height: 256px; width: 256px; position: absolute; top: 0px; left: 0px;';
		tilesetCanvas.width = tilesetCanvas.height = 256;
		raws.appendChild(tilesetCanvas);

		const tilesetAnimatedCanvas = document.createElement('canvas');
		tilesetAnimatedCanvas.style.cssText = 'height: 256px; width: 256px; position: absolute; top: 0; left: 256px;';
		tilesetAnimatedCanvas.width = tilesetAnimatedCanvas.height = 256;
		raws.appendChild(tilesetAnimatedCanvas);

		const paletteCanvas = document.createElement('canvas');
		paletteCanvas.style.cssText = 'height: 128px; width: 128px; position: absolute; top: 0px;';
		paletteCanvas.width = paletteCanvas.height = 16;
		raws.appendChild(paletteCanvas);

		const sideInfo = document.createElement('div');
		sideInfo.style.cssText = 'position: absolute; top: 0; padding: 5px;';
		preview.appendChild(sideInfo);

		const updatePreviewLayout = () => {
			if (options.palette.checked) paletteCanvas.style.display = '';
			else paletteCanvas.style.display = 'none';

			if (options.tilesets.checked) tilesetCanvas.style.display = tilesetAnimatedCanvas.style.display = '';
			else tilesetCanvas.style.display = tilesetAnimatedCanvas.style.display = 'none';

			if (options.palette.checked || options.tilesets.checked) raws.style.display = '';
			else raws.style.display = 'none';

			if (options.tilesets.checked) raws.style.height = '256px';
			else raws.style.height = '128px';

			if (options.palette.checked) {
				if (options.tilesets.checked) paletteCanvas.style.left = '512px';
				else paletteCanvas.style.left = '0px';
			}

			if (options.palette.checked && options.tilesets.checked) raws.style.width = sideInfo.style.left = '640px';
			else raws.style.width = sideInfo.style.left = '512px';
		};
		updatePreviewLayout();

		const metaPreview = document.createElement('div');
		section.appendChild(metaPreview);

		const layerPermutations = [
			[0, 1, 2],
			[0, 2, 1],
			[2, 0, 1],
			[2, 1, 0],
			[1, 0, 2],
			[1, 2, 0],
		];
		const layerPermutationsStringified =
			layerPermutations.map(([a, b, c]) => `BG${a + 1} > BG${b + 1} > BG${c + 1}`);

		let room = (battle.room = undefined);
		const update = () => {
			const rawRoom = bmaps[bmapDropdown.value];
			battle.room = room = {
				tileset: rawRoom.tileset?.byteLength ? bufToU8(lzBis(rawRoom.tileset)) : undefined,
				palette: rawRoom.palette?.byteLength ? rgb15To32(bufToU16(rawRoom.palette)) : undefined,
				tilemaps: rawRoom.tilemaps.map(x => (x?.byteLength ? bufToU16(x) : undefined)),
				tilesetAnimated: rawRoom.tilesetAnimated?.byteLength
					? bufToU8(lzBis(rawRoom.tilesetAnimated))
					: undefined,
				paletteAnimations: rfx.parse(rawRoom.paletteAnimations),
				bgAnimations: rfx.parse(rawRoom.bgAnimations),
				config: fsext.bmapConfig?.[bmapDropdown.value],
			};

			// side info
			if (room.config) {
				const permutation = layerPermutationsStringified[room.config.getInt8(8)];
				sideInfo.innerHTML =
					`<div>BG2 parallax X: ${room.config.getInt8(0)} / 32</div>
					<div>BG2 parallax Y: ${room.config.getInt8(1)} / 32</div>
					<div>BG3 parallax X: ${room.config.getInt8(2)} / 32</div>
					<div>BG3 parallax Y: ${room.config.getInt8(3)} / 32</div>
					<div>BG2 autoscroll X: ${room.config.getInt8(4)}</div>
					<div>BG2 autoscroll Y: ${room.config.getInt8(5)}</div>
					<div>BG3 autoscroll X: ${room.config.getInt8(6)}</div>
					<div>BG3 autoscroll Y: ${room.config.getInt8(7)}</div>
					<div>Layer permutation: ${permutation ?? ''} (${room.config.getInt8(8)})</div>`;
			}

			const sprite = fsext.bmapSprites?.[bmapDropdown.value];
			if (sprite !== undefined) {
				addHTML(sideInfo, `<div>BObjMap sprite: <code>${str32(sprite)}</code></div>`);
			}

			// metadata below
			metaPreview.innerHTML = '';

			if (room.tileset)
				addHTML(
					metaPreview,
					`<div><code>[0]</code> tileset: 0x${Math.ceil(room.tileset.length / 32).toString(16)} tiles</div>`,
				);
			else addHTML(metaPreview, '<div><code>[0]</code> tileset: none</div>');

			addHTML(metaPreview, `<div><code>[1]</code> palette: ${room.palette ? 'exists' : ''}</div>`);

			for (let layer = 0; layer < 3; ++layer) {
				const container = document.createElement('div');
				container.innerHTML = `<code>[${2 + layer}]</code> tilemaps[${layer}] (BG${layer + 1}): `;

				const tilemap = room.tilemaps[layer];
				if (tilemap?.byteLength) {
					const tilemapContainer = document.createElement('div');
					tilemapContainer.style.cssText =
						'border: 1px solid var(--line); padding: 5px; display: none; overflow-x: scroll;';
					container.appendChild(
						checkbox('Tilemap', false, checked => {
							if (checked) {
								const lines = [];
								for (let y = 0, o = 0; y < 32; ++y) {
									const line = [];
									for (let x = 0; x < 64; ++x, ++o) {
										line.push(tilemap[o] ? str16(tilemap[o]) : '----');
									}
									lines.push(line.join(' '));
								}
								tilemapContainer.style.display = '';
								tilemapContainer.innerHTML = `<code style="white-space: pre;">${lines.join('\n')}</code>`;
							} else {
								tilemapContainer.style.display = 'none';
								tilemapContainer.innerHTML = '';
							}
						}),
					);
					container.appendChild(tilemapContainer);
				}
				metaPreview.appendChild(container);
			}

			const pafAnimationsUl = document.createElement('ul');
			const decoratedPafAnimations = rfx.parse(rawRoom.paletteAnimations);
			for (let i = 0; i < decoratedPafAnimations.length; ++i) {
				const track = decoratedPafAnimations[i];
				if (!track) {
					addHTML(pafAnimationsUl, `<li><code>[${i}]</code> (empty)</li>`);
					continue;
				}

				rfx.pafDecorateTrack(track);

				let style = 'padding: 2px 0;';
				if (i === decoratedPafAnimations.length - 1) style += 'color: var(--fg-dim)';

				const li = document.createElement('li');
				li.style.cssText = style;
				addHTML(li, `<code>[${i}]</code>`);

				for (const part of rfx.trackToHtml(decoratedPafAnimations[i])) {
					addHTML(li, ' ');
					li.appendChild(part);
				}

				pafAnimationsUl.appendChild(li);
			}

			const pafAnimationsDiv = document.createElement('div');
			addHTML(pafAnimationsDiv, '<code>[5]</code> paletteAnimations: ');
			pafAnimationsDiv.appendChild(pafAnimationsUl);
			metaPreview.appendChild(pafAnimationsDiv);

			const bgAnimationsUl = document.createElement('ul');
			const decoratedBgAnimations = rfx.parse(rawRoom.bgAnimations);
			for (let i = 0; i < decoratedBgAnimations.length; ++i) {
				if (!decoratedBgAnimations[i]) {
					addHTML(bgAnimationsUl, `<li><code>[${i}]</code> (empty)</li>`);
					continue;
				}

				rfx.bafDecorateTrack(decoratedBgAnimations[i]);

				let style = 'padding: 2px 0;';
				if (i === decoratedBgAnimations.length - 1) style += 'color: var(--fg-dim)';

				const li = document.createElement('li');
				li.style.cssText = style;
				addHTML(li, `<code>[${i}]</code>`);

				for (const part of rfx.trackToHtml(decoratedBgAnimations[i])) {
					addHTML(li, ' ');
					li.appendChild(part);
				}

				bgAnimationsUl.appendChild(li);
			}

			const bgAnimationsDiv = document.createElement('div');
			addHTML(bgAnimationsDiv, '<code>[6]</code> bgAnimations: ');
			bgAnimationsDiv.appendChild(bgAnimationsUl);
			metaPreview.appendChild(bgAnimationsDiv);

			if (room.tilesetAnimated) {
				// find the maximum tile used by any animation
				let tilesEnd = 0;
				for (const track of room.bgAnimations) {
					if (!track) continue;

					let src, size;
					for (const matrix of track.matrices) {
						const opcode = matrix[0][0] & 0x3f;
						if (opcode === 0) { // configure keyframes
							let maxIndex = 0;
							for (let x = 1; x < matrix[0].length; ++x) {
								if (maxIndex < matrix[0][x]) maxIndex = matrix[0][x];
							}

							if (src === undefined || size === undefined) continue;
							const end = src + size * (maxIndex + 1);
							if (tilesEnd < end) tilesEnd = end;
						} else if (opcode === 1) { // configure tileset range
							size = matrix[1][1];
							src = matrix[2][1];
						}
					}
				}

				let html = `<code>[7]</code> tilesetAnimated: 0x${tilesEnd} tiles`;
				if (tilesEnd * 32 < room.tilesetAnimated.byteLength) {
					html += `, debug info or unused tiles: <ul>
						<li style="overflow-wrap: anywhere;"><code>${latin1(tilesEnd * 32, Infinity, room.tilesetAnimated)}</code></li>
						<li><code>${bytes(tilesEnd * 32, Infinity, room.tilesetAnimated)}</code></li>
					</ul>`;
				}

				addHTML(metaPreview, `<div>${html}</div>`);
			} else {
				addHTML(metaPreview, '<div><code>[7]</code> tilesetAnimated:</div>');
			}

			updatePalette = updateTileset = updateTilesetAnimated = updateMap = true;
		};

		const palette = new Uint32Array(256);
		const render = () => {
			if (options.paletteAnimations.checked && room.paletteAnimations.length)
				updatePalette = updateTileset = updateTilesetAnimated = updateMap = true;
			if (options.bgAnimations.checked && room.bgAnimations.length) updateTileset = updateMap = true;
			if (room.config?.getUint32(4)) updateMap = true; // autoscroll

			const tick = Math.floor((performance.now() / 1000) * 60);

			// palette
			if (updatePalette) {
				const paletteCtx = paletteCanvas.getContext('2d');
				if (room.palette) {
					palette.set(room.palette, 0);
					if (options.paletteAnimations.checked) rfx.pafApply(palette, room.paletteAnimations, tick);
					paletteCtx.putImageData(new ImageData(bufToU8Clamped(palette), 16, 16), 0, 0);
				} else {
					palette.fill(0, 0, 256);
					paletteCtx.clearRect(0, 0, 16, 16);
				}
			}

			if (updateTileset || updateTilesetAnimated || updateMap) {
				// tileset
				const layout = new Array(1024);
				const tilesetCtx = tilesetCanvas.getContext('2d');
				if (room.tileset) {
					for (let i = 0; i < 1024; ++i) layout[i] = room.tileset.slice(i * 32, i * 32 + 32);

					if (options.bgAnimations.checked) {
						for (const track of room.bgAnimations) {
							if (!track) continue;

							let dst, size, src;
							for (const matrix of track.matrices) {
								const opcode = matrix[0][0] & 0x3f;

								if (opcode === 0) { // configure keyframes (row 0 = frame, row 1 = duration)
									let totalLength = 0;
									for (let x = 1; x < matrix[1].length; ++x) {
										totalLength += matrix[1][x];
									}

									let localTick = tick % totalLength;
									let frame = 0;
									for (let x = 1; x < matrix[1].length; ++x) {
										if (localTick < matrix[1][x]) {
											frame = matrix[0][x];
											break;
										}

										localTick -= matrix[1][x];
									}

									for (let j = 0, o = (src + frame * size) * 32; j < size; ++j, o += 32) {
										layout[dst + j] = room.tilesetAnimated.slice(o, o + 32);
									}
								} else if (opcode === 1) { // configure tileset range
									dst = matrix[0][1];
									size = matrix[1][1];
									src = matrix[2][1];
								}
							}
						}
					}

					const tilesetBitmap = new Uint32Array(256 * 256);
					for (let i = 0; i * 32 < room.tileset.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						// 16-color
						for (let j = 0; j < 32; ++j) {
							const pos = basePos | ((j >> 2) << 8) | ((j & 0x3) << 1);
							const composite = layout[i][j] ?? 0;
							tilesetBitmap[pos] = palette[composite & 0xf];
							tilesetBitmap[pos ^ 1] = palette[composite >> 4];
						}
					}
					tilesetCtx.putImageData(new ImageData(bufToU8Clamped(tilesetBitmap), 256, 256), 0, 0);
				} else {
					tilesetCtx.clearRect(0, 0, 256, 256);
				}

				// tilesetAnimated
				const tilesetAnimatedCtx = tilesetAnimatedCanvas.getContext('2d');
				if (room.tilesetAnimated) {
					const bitmap = new Uint32Array(256 * 256);
					for (let i = 0; i * 32 < room.tilesetAnimated.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						// 16-color
						for (let j = 0; j < 32; ++j) {
							const pos = basePos | ((j >> 2) << 8) | ((j & 0x3) << 1);
							const composite = room.tilesetAnimated[i * 32 + j] ?? 0;
							bitmap[pos] = palette[composite & 0xf];
							bitmap[pos ^ 1] = palette[composite >> 4];
						}
					}
					tilesetAnimatedCtx.putImageData(new ImageData(bufToU8Clamped(bitmap), 256, 256), 0, 0);
				} else {
					tilesetAnimatedCtx.clearRect(0, 0, 256, 256);
				}

				// map
				const mapCtx = mapCanvas.getContext('2d');
				if (updateMap) {
					const height = options.margins.checked ? 256 : 192;
					mapCanvas.height = height;
					if (room.tileset) {
						const mapBitmap = new Uint32Array(512 * 256);
						mapBitmap.fill(palette[0], 0, 512 * 256);
						for (let i = 2; i >= 0; --i) {
							const layerIndex = (layerPermutations[room.config?.getInt8(8)] ?? [0, 1, 2])[i];
							const tilemap = room.tilemaps[layerIndex];
							if (!options.bgChecks[layerIndex].checked || !tilemap) continue;

							let offsetX = 0;
							let offsetY = 0;
							if (options.autoscroll.checked && room.config && layerIndex !== 0) {
								const speedX = room.config.getInt8(layerIndex === 1 ? 4 : 6);
								const speedY = room.config.getInt8(layerIndex === 1 ? 5 : 7);
								offsetX = (((tick & 0xfff) * -(speedX << 3)) >> 8) & 0x1ff;
								offsetY = (((tick & 0x7ff) * -(speedY << 3)) >> 8) & 0xff;
							}

							for (let j = 0; j < tilemap.length; ++j) {
								const tile = tilemap[j];
								const paletteRow = (tile >> 12) << 4;

								const basePosX = offsetX + ((j & 0x3f) << 3);
								const basePosY = offsetY + ((j >> 6) << 3);
								for (let k = 0; k < 32; ++k) {
									let x = (k & 3) << 1;
									let y = k >> 2;
									if (tile & 0x400) x ^= 7; // horizontal flip
									if (tile & 0x800) y ^= 7; // vertical flip

									const pos1 = (((basePosY + y) & 0xff) << 9) | ((basePosX + x) & 0x1ff);
									const pos2 = (((basePosY + y) & 0xff) << 9) | ((basePosX + (x ^ 1)) & 0x1ff);

									const composite = layout[tile & 0x3ff][k] ?? 0;
									if (composite & 0xf) mapBitmap[pos1] = palette[paletteRow | (composite & 0xf)];
									if (composite >> 4) mapBitmap[pos2] = palette[paletteRow | (composite >> 4)];
								}
							}
						}
						mapCtx.putImageData(
							new ImageData(bufToU8Clamped(mapBitmap), 512, 256),
							0,
							options.margins.checked ? 0 : -32,
						);
					} else {
						mapCtx.clearRect(0, 0, 512, height);
					}
				}
			}

			updatePalette = updateTileset = updateTilesetAnimated = updateMap = false;

			requestAnimationFrame(render);
		};
		update();
		render();

		battle.png = (roomId, bg1, bg2, bg3, margins) => {
			// this is almost identical to field.png
			const rawRoom = battle.bmaps[roomId];
			const tileset = bufToU8(lzBis(rawRoom.tileset));
			const palette = rgb15To32(bufToU16(rawRoom.palette));
			const tilemaps = rawRoom.tilemaps.map(x => (x?.byteLength ? bufToU16(x) : undefined));

			const config = fsext.bmapConfig?.[roomId];

			const inset = margins ? 0 : 4;

			const bitmap = new Uint32Array(512 * (margins ? 256 : 192));
			bitmap.fill(palette[0], 0, bitmap.length);
			for (let i = 2; i >= 0; --i) {
				const layerIndex = (layerPermutations[config?.getInt8(8)] ?? [0, 1, 2])[i];
				const tilemap = tilemaps[layerIndex];
				if (![bg1, bg2, bg3][i] || !tilemap) continue;

				for (let y = inset; y < 32 - inset; ++y) {
					for (let x = 0; x < 64; ++x) {
						const basePos = ((y - inset) << 12) | (x << 3);
						const tile = tilemap[y * 64 + x];
						// 16-color
						const paletteShift = (tile >> 12) << 4;
						for (let j = 0, o = (tile & 0x3ff) * 32; j < 64; j += 2, ++o) {
							let pos = basePos | ((j >> 3) << 9) | (j & 7);
							if (tile & 0x400) pos ^= 7; // horizontal flip
							if (tile & 0x800) pos ^= 7 << 9; // vertical flip
							const composite = tileset[o] ?? 0;
							if (composite & 0xf) bitmap[pos] = palette[paletteShift | (composite & 0xf)];
							if (composite >> 4) bitmap[pos ^ 1] = palette[paletteShift | (composite >> 4)];
						}
					}
				}
			}

			return png(bitmap, 512, margins ? 256 : 192);
		};

		return battle;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Giant Battle Maps                                                                                    |
	// +---------------------------------------------------------------------------------------------------------------+

	const battleGiant = (window.battleGiant = createSection('Giant Battle Maps', section => {
		const battleGiant = {};

		if (!fs.has('/BMapG/BMapG.dat')) {
			addHTML(
				section,
				`<div>This version (${headers.gamecode}) doesn't have /BMapG/BMapG.dat (the giant battle map file)</div>`,
			);
			return;
		}

		const bmapg = fsext.battle.get('/BMapG/BMapG.dat');

		const selectOptions = [];
		for (let i = 0; i < bmapg.length; ++i) selectOptions.push(`BMapG 0x${i.toString(16)}`);
		const bmapgSelect = dropdown(selectOptions, 0, () => render());
		section.appendChild(bmapgSelect);

		const bgChecks = [];
		section.appendChild((bgChecks[0] = checkbox('BG1', true, () => render())));
		section.appendChild((bgChecks[1] = checkbox('BG2', true, () => render())));

		const mapCanvas = document.createElement('canvas');
		mapCanvas.style.cssText = 'width: 2048px; height: 512px;';
		mapCanvas.width = 2048;
		mapCanvas.height = 512;
		section.appendChild(mapCanvas);

		const componentPreview = document.createElement('div');
		componentPreview.style.cssText = 'height: 256px; position: relative;';
		section.appendChild(componentPreview);

		const tilesetCanvas = document.createElement('canvas');
		tilesetCanvas.style.cssText = 'position: absolute; top: 0px; left: 0px; width: 256px; height: 256px;';
		tilesetCanvas.width = tilesetCanvas.height = 256;
		componentPreview.appendChild(tilesetCanvas);

		const paletteCanvas = document.createElement('canvas');
		paletteCanvas.style.cssText = 'position: absolute; top: 0px; left: 256px; width: 128px; height: 128px;';
		paletteCanvas.width = paletteCanvas.height = 16;
		componentPreview.appendChild(paletteCanvas);

		const metaPreview = document.createElement('div');
		section.appendChild(metaPreview);

		const render = () => {
			const room = unpackSegmented32(lzBis(bmapg[bmapgSelect.value]));
			const palette = room[0]?.byteLength && rgb15To32(bufToU16(room[0]));
			const tileset = room[1]?.byteLength && bufToU8(room[1]);
			const tilemaps = [2, 3].map(index => room[index]?.byteLength && bufToU16(room[index]));
			const unknown4 = room[4];
			const unknown5 = room[5];
			const unknown6 = room[6];

			// palette
			const paletteCtx = paletteCanvas.getContext('2d');
			if (palette) paletteCtx.putImageData(new ImageData(bufToU8Clamped(palette), 16, 16), 0, 0);
			else paletteCtx.clearRect(0, 0, 16, 16);

			// tileset
			const tilesetCtx = tilesetCanvas.getContext('2d');
			if (palette && tileset) {
				const tilesetBitmap = new Uint32Array(256 * 256);
				let o = 0;
				for (let i = 0; i * 64 < tileset.byteLength; ++i) {
					const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
					// 256-color
					for (let j = 0; j < 64; ++j) {
						const pos = basePos | ((j >> 3) << 8) | (j & 0x7);
						tilesetBitmap[pos] = palette[tileset[i * 64 + j] ?? 0];
					}
				}
				tilesetCtx.putImageData(new ImageData(bufToU8Clamped(tilesetBitmap), 256, 256), 0, 0);
			} else {
				tilesetCtx.clearRect(0, 0, 256, 256);
			}

			// map
			const mapCtx = mapCanvas.getContext('2d');
			if (palette && tileset) {
				const mapBitmap = new Uint32Array(2048 * 512);
				// maybe there are more layers, so use an array
				for (let i = 1; i >= 0; --i) {
					const tilemap = tilemaps[i];
					if (!bgChecks[i].checked) continue;

					for (let j = 0; j < tilemap.length; ++j) {
						const tile = tilemap[j];

						// 256-color
						const basePos = ((j >> 7) << 14) | ((j & 0x7f) << 3); // y = i >> 7, x = i & 0x7f
						const tileOffset = (tile & 0x3ff) * 64;
						for (let k = 0; k < 64; ++k) {
							let pos = basePos | ((k >> 3) << 11) | (k & 0x7);
							if (tile & 0x400) pos ^= 0x7; // horizontal flip
							if (tile & 0x800) pos ^= 0x7 << 11; // vertical flip

							const paletteIndex = tileset[tileOffset + k] ?? 0;
							if (!paletteIndex) continue;
							mapBitmap[pos] = palette[paletteIndex];
						}
					}
				}

				mapCtx.putImageData(new ImageData(bufToU8Clamped(mapBitmap), 2048, 512), 0, 0);
			} else {
				mapCtx.clearRect(0, 0, 2048, 512);
			}

			// metadata below
			metaPreview.innerHTML = '';

			const metaLines = [];
			metaLines.push(`Tilemap sizes: ${tilemaps[0]?.byteLength}, ${tilemaps[1]?.byteLength}`);
			metaLines.push(`unknown4 size: ${unknown4?.byteLength}`);
			metaLines.push(`unknown4 preview: <code>${bytes(0, 256, unknown4)}</code>`);
			metaLines.push(`unknown5 size: ${unknown5?.byteLength}`);
			metaLines.push(`unknown5 preview: <code>${bytes(0, 256, unknown5)}</code>`);
			metaLines.push(`unknown6 size: ${unknown6?.byteLength}`);
			metaLines.push(`unknown6 preview: <code>${bytes(0, 256, unknown6)}</code>`);
			for (const metaLine of metaLines) addHTML(metaPreview, '<div>' + metaLine + '</div>');
		};
		render();

		return battleGiant;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Menu Maps                                                                                            |
	// +---------------------------------------------------------------------------------------------------------------+

	const menu = (window.menu = createSection('Menu Maps', section => {
		const menu = {};

		const menuFile = fs.get('/MMap/MMap.dat');
		const maps = (menu.maps = unpackSegmentedFile(menuFile, 0, menuFile));

		const tilesetOptions = [];
		const tilemapOptions = [];
		const paletteOptions = [];
		for (let i = 0; i < maps.length; ++i) {
			if (maps[i].byteLength === 512) {
				paletteOptions.push([`MMap Palette 0x${i.toString(16)}`, i]);
			} else {
				tilesetOptions.push([`MMap Tileset 0x${i.toString(16)}`, i]);
				tilemapOptions.push([`MMap Tilemap 0x${i.toString(16)}`, i]);
			}
		}

		const tilesetSelect = dropdown(
			tilesetOptions.map(x => x[0]),
			0,
			() => render(),
		);
		section.appendChild(tilesetSelect);
		const tilemapSelect = dropdown(
			tilemapOptions.map(x => x[0]),
			1,
			() => render(),
		);
		section.appendChild(tilemapSelect);
		const paletteSelect = dropdown(
			paletteOptions.map(x => x[0]),
			0,
			() => render(),
		);
		section.appendChild(paletteSelect);

		const mapContainer = document.createElement('div');
		mapContainer.style.cssText = 'position: relative; height: 192px;';
		section.appendChild(mapContainer);

		const mapCanvas16 = document.createElement('canvas');
		mapCanvas16.width = 256;
		mapCanvas16.height = 192;
		mapCanvas16.style.cssText = 'position: absolute; top: 0; left: 0;';
		mapContainer.appendChild(mapCanvas16);

		const mapCanvas256 = document.createElement('canvas');
		mapCanvas256.width = 256;
		mapCanvas256.height = 192;
		mapCanvas256.style.cssText = 'position: absolute; top: 0; left: 256px;';
		mapContainer.appendChild(mapCanvas256);

		const componentContainer = document.createElement('div');
		componentContainer.style.cssText = 'position: relative; height: 256px;';
		section.appendChild(componentContainer);

		const tilesetCanvas16 = document.createElement('canvas');
		tilesetCanvas16.width = tilesetCanvas16.height = 256;
		tilesetCanvas16.style.cssText = 'position: absolute; top: 0; left: 0;';
		componentContainer.appendChild(tilesetCanvas16);

		const tilesetCanvas256 = document.createElement('canvas');
		tilesetCanvas256.width = tilesetCanvas256.height = 256;
		tilesetCanvas256.style.cssText = 'position: absolute; top: 0; left: 256px;';
		componentContainer.appendChild(tilesetCanvas256);

		const paletteCanvas = document.createElement('canvas');
		paletteCanvas.width = paletteCanvas.height = 16;
		paletteCanvas.style.cssText = 'position: absolute; top: 0; left: 512px; width: 128px; height: 128px;';
		componentContainer.appendChild(paletteCanvas);

		const render = () => {
			// palette
			const paletteDat = maps[paletteOptions[paletteSelect.value][1]];
			let palette;
			if (paletteDat.byteLength === 512) {
				palette = rgb15To32(bufToU16(paletteDat));
			}

			{
				const ctx = paletteCanvas.getContext('2d');
				if (palette) {
					ctx.putImageData(new ImageData(bufToU8Clamped(palette), 16, 16), 0, 0);
				} else {
					ctx.clearRect(0, 0, 16, 16);
				}
			}

			// tileset
			const tilesetDat = maps[tilesetOptions[tilesetSelect.value][1]];
			let tileset;
			try {
				tileset = bufToU8(lzBis(tilesetDat));
			} catch (_) {}
			{
				const ctx16 = tilesetCanvas16.getContext('2d');
				const ctx256 = tilesetCanvas256.getContext('2d');
				if (tileset && palette) {
					const bitmap16 = new Uint32Array(256 * 256);
					const bitmap256 = new Uint32Array(256 * 256);
					// 16-color
					for (let i = 0; i * 32 < tileset.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						for (let j = 0; j < 32; ++j) {
							const pos = basePos | ((j >> 2) << 8) | ((j & 0x3) << 1);
							const composite = tileset[i * 32 + j];
							bitmap16[pos] = palette[composite & 0xf];
							bitmap16[pos ^ 1] = palette[composite >> 4];
						}
					}

					ctx16.putImageData(new ImageData(bufToU8Clamped(bitmap16), 256, 256), 0, 0);

					// 256-color
					for (let i = 0; i * 64 < tileset.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						for (let j = 0; j < 64; ++j) {
							const pos = basePos | ((j >> 3) << 8) | (j & 0x7);
							bitmap256[pos] = palette[tileset[i * 64 + j]];
						}
					}

					ctx256.putImageData(new ImageData(bufToU8Clamped(bitmap256), 256, 256), 0, 0);
				} else {
					ctx16.clearRect(0, 0, 256, 256);
					ctx256.clearRect(0, 0, 256, 256);
				}
			}

			// tilemap
			const tilemapDat = maps[tilemapOptions[tilemapSelect.value][1]];
			let tilemap;
			try {
				tilemap = bufToU16(lzBis(tilemapDat));
			} catch (_) {}

			{
				const ctx16 = mapCanvas16.getContext('2d');
				const ctx256 = mapCanvas256.getContext('2d');

				if (tilemap && tileset && palette) {
					// 16-color
					const bitmap16 = new Uint32Array(256 * 192);
					for (let i = 0; i < tilemap.length; ++i) {
						const basePos = ((i >> 6) << 12) | ((i & 0x3f) << 3);
						const tile = tilemap[i];
						const tileOffset = (tile & 0x3ff) * 32;
						const paletteRow = (tile >> 12) << 4;
						for (let j = 0; j < 32; ++j) {
							let pos = basePos | ((j >> 2) << 9) | ((j & 0x3) << 1);
							if (tile & 0x400) pos ^= 0x7;
							if (tile & 0x800) pos ^= 0x7 << 8;

							const composite = tileset[tileOffset + j];
							if (composite & 0xf) bitmap16[pos] = palette[paletteRow | (composite & 0xf)];
							if (composite >> 4) bitmap16[pos ^ 1] = palette[paletteRow | (composite >> 4)];
						}
					}

					ctx16.putImageData(new ImageData(bufToU8Clamped(bitmap16), 256, 192), 0, 0);

					// 256-color
					const bitmap256 = new Uint32Array(256 * 192);
					for (let i = 0; i < tilemap.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3);
						const tile = tilemap[i];
						const tileOffset = (tile & 0x3ff) * 64;
						for (let j = 0; j < 64; ++j) {
							let pos = basePos | ((j >> 3) << 8) | (j & 0x7);
							if (tile & 0x400) pos ^= 0x7;
							if (tile & 0x800) pos ^= 0x7 << 8;

							const paletteIndex = tileset[tileOffset + j];
							if (paletteIndex) bitmap256[pos] = palette[paletteIndex];
						}
					}

					ctx256.putImageData(new ImageData(bufToU8Clamped(bitmap256), 256, 192), 0, 0);
				} else {
					ctx16.clearRect(0, 0, 256, 192);
					ctx256.clearRect(0, 0, 256, 192);
				}
			}
		};
		render();

		return menu;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Fonts                                                                                                |
	// +---------------------------------------------------------------------------------------------------------------+

	const fonts = (window.fonts = createSection('Fonts', section => {
		const fonts = {};

		fonts.glyphs1Bit = (dat, dataWidth, dataHeight, glyphWidth, glyphHeight) => {
			const u8 = bufToU8(dat);
			const glyphs = [];

			const glyphY = glyphHeight - dataHeight - 3;

			const byteSkip = Math.ceil((dataWidth * dataHeight) / 8);
			for (let o = 0; o < u8.length; o += byteSkip) {
				const bitmap = new Uint8Array(glyphWidth * glyphHeight);
				for (let y = 0, bitOffset = 0; y < dataHeight; ++y) {
					for (let x = 0; x < dataWidth; ++x, ++bitOffset) {
						const bit = u8[o + (bitOffset >> 3)] & (0x80 >> (bitOffset & 7));
						if (bit) {
							bitmap[(y + glyphY) * glyphWidth + x] = 2;
							bitmap[(y + glyphY - 1) * glyphWidth + x] ||= 1; // up shadow
							if (x > 0) bitmap[(y + glyphY + 1) * glyphWidth + (x - 1)] ||= 1; // left shadow
							bitmap[(y + glyphY + 1) * glyphWidth + x] ||= 1; // down shadow
							bitmap[(y + glyphY) * glyphWidth + (x + 1)] ||= 1; // right shadow
						}
					}
				}
				glyphs.push(bitmap);
			}

			return glyphs;
		};

		fonts.glyphs2Bit = (dat, width, height) => {
			const u8 = bufToU8(dat);
			const glyphs = [];

			for (let o = 0; o < u8.length; ) {
				const bitmap = new Uint8Array(width * height);
				const startO = o;
				for (let baseX = 0; baseX < width; baseX += 8) {
					const columnWidth = Math.min(8, width - baseX);
					for (let baseY = 0; baseY < height; baseY += 4) {
						const alphaO = o;
						const shadeO = o + (columnWidth >> 1);
						o += columnWidth;
						for (let x = 0, bitOffset = 0; x < columnWidth; ++x) {
							for (let y = 0; y < 4; ++y, ++bitOffset) {
								const alpha = u8[alphaO + (bitOffset >> 3)] & (1 << (bitOffset & 7));
								const shade = u8[shadeO + (bitOffset >> 3)] & (1 << (bitOffset & 7));
								bitmap[(baseY + y) * width + baseX + x] = alpha ? (shade ? 1 : 2) : 0;
							}
						}
					}
				}
				bitmap.SLICE = sliceDataView(dat, startO, o);
				glyphs.push(bitmap);
			}

			return glyphs;
		};

		fonts.standard = dat => {
			const chars = new Map();
			const charMapSize = dat.getUint32(0, true);
			const segments = unpackSegmentedUnsorted(dat, 4);
			const charMap = segments.shift();

			const byGlyph = new Map();
			for (let i = 0; i < segments.length; ++i) {
				const glyphTable = segments[i];
				const glyphWidth = (glyphTable.getUint8(0) >> 4) * 4;
				const glyphHeight = (glyphTable.getUint8(0) & 0xf) * 4;
				const numGlyphs = glyphTable.getUint8(3) * 8;

				const actualWidths = [];
				let o = 4;
				if (glyphWidth <= 16) {
					for (let j = 0; j < numGlyphs; j += 2) {
						const composite = glyphTable.getUint8(o++);
						actualWidths.push(composite & 0xf, composite >> 4);
					}
				} else {
					for (let j = 0; j < numGlyphs; ++j) {
						actualWidths.push(glyphTable.getUint8(o++));
					}
				}

				const glyphs = fonts.glyphs2Bit(
					sliceDataView(glyphTable, o, glyphTable.byteLength),
					glyphWidth,
					glyphHeight,
				);
				for (let j = 0; j < glyphs.length; ++j) {
					byGlyph.set((i << 8) | j, {
						actualWidth: actualWidths[j] + 1,
						bitmap: glyphs[j],
						height: glyphHeight,
						width: glyphWidth,
					});
				}
			}

			const byCode = new Map();
			for (let i = 0, o = 0; o < charMapSize; ++i, o += 2) {
				const glyphId = charMap.getInt16(o, false); // big endian!!
				if (glyphId === -1) continue;
				byCode.set(i, byGlyph.get(glyphId));
			}

			return { byCode, byGlyph };
		};

		fonts.fixed = (dat, dataWidth, dataHeight, glyphWidth, glyphHeight, is2Bit) => {
			const byGlyph = new Map();
			const glyphs = is2Bit
				? fonts.glyphs2Bit(dat, dataWidth, dataHeight)
				: fonts.glyphs1Bit(dat, dataWidth, dataHeight, glyphWidth, glyphHeight);
			for (let i = 0; i < glyphs.length; ++i) {
				byGlyph.set(i, { actualWidth: glyphWidth, bitmap: glyphs[i], height: glyphHeight, width: glyphWidth });
			}

			return { byCode: byGlyph, byGlyph };
		};

		fonts.preview = (table, glyphsPerRow, showActualWidth) => {
			let maxGlyphWidth = 0;
			let maxGlyphHeight = 0;
			let maxKey = 0;
			for (const [key, char] of table) {
				if (key > maxKey) maxKey = key;
				if (char.width > maxGlyphWidth) maxGlyphWidth = char.width;
				if (char.height > maxGlyphHeight) maxGlyphHeight = char.height;
			}

			const paddedGlyphWidth = maxGlyphWidth + 2;
			const paddedGlyphHeight = maxGlyphHeight + 2;

			const bitmapWidth = paddedGlyphWidth * glyphsPerRow || 1;
			const bitmapHeight = paddedGlyphHeight * Math.ceil((maxKey + 1) / glyphsPerRow) || 1;
			const bitmap = new Uint32Array(bitmapWidth * bitmapHeight);
			for (let i = 0; i <= maxKey; ++i) {
				const cellX = i % glyphsPerRow;
				const baseX = cellX * paddedGlyphWidth;
				const cellY = Math.floor(i / glyphsPerRow);
				const baseY = cellY * paddedGlyphHeight;
				const oddTile = (cellX & 1) ^ (cellY & 1);

				const glyph = table.get(i);
				if (!glyph) continue;

				for (let y = 0; y < paddedGlyphHeight; ++y) {
					bitmap.fill(
						oddTile ? 0xffd6f7ff : 0xffa5cee6,
						(baseY + y) * bitmapWidth + baseX,
						(baseY + y) * bitmapWidth + baseX + paddedGlyphWidth,
					);
				}

				const { actualWidth, width, height, bitmap: glyphBitmap } = glyph;

				for (let y = 0; y < height; ++y) {
					for (let x = 0; x < width; ++x) {
						const color = glyphBitmap[y * width + x];
						// +1 on each component for padding
						if (color)
							bitmap[(baseY + y + 1) * bitmapWidth + baseX + x + 1] =
								color === 1 ? 0xffdee6ef : 0xff314263;
					}
				}

				if (showActualWidth) {
					for (let x = 0; x < actualWidth; ++x) {
						bitmap[(baseY + paddedGlyphHeight - 1) * bitmapWidth + baseX + x + 1] = 0xff0099ff;
					}
				}
			}

			return { bitmap, bitmapWidth, bitmapHeight };
		};

		const errorGlyph = {
			bitmap: new Uint32Array(16 * 11),
			width: 16,
			height: 11,
			actualWidth: 16,
		};
		errorGlyph.bitmap.set([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], 0);
		errorGlyph.bitmap.set([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], 16); // padding
		errorGlyph.bitmap.set([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], 16 * 2); // padding
		errorGlyph.bitmap.set([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], 16 * 3);
		errorGlyph.bitmap.set([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], 16 * 4);
		errorGlyph.bitmap.set([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], 16 * 5);
		errorGlyph.bitmap.set([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], 16 * 6);
		errorGlyph.bitmap.set([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], 16 * 7);
		errorGlyph.bitmap.set([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], 16 * 8); // padding
		errorGlyph.bitmap.set([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], 16 * 9); // padding
		errorGlyph.bitmap.set([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], 16 * 10);

		const variableGlyph = {
			bitmap: new Uint32Array(16 * 16),
			width: 16,
			height: 16,
			actualWidth: 16,
		};
		variableGlyph.bitmap.set([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], 0);
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 1); // padding
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 2);
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 3);
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 4);
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 5);
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 6);
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 7); // padding
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 8); // padding
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 9);
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 10);
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 11);
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 12);
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 13);
		variableGlyph.bitmap.set([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 16 * 14); // padding
		variableGlyph.bitmap.set([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], 16 * 15);

		const customGlyphChars = [];
		customGlyphChars.push([0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0]); // 0
		customGlyphChars.push([0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1]); // 1
		customGlyphChars.push([0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1]); // 2
		customGlyphChars.push([1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0]); // 3
		customGlyphChars.push([1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1]); // 4
		customGlyphChars.push([1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0]); // 5
		customGlyphChars.push([0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0]); // 6
		customGlyphChars.push([1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0]); // 7
		customGlyphChars.push([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]); // 8
		customGlyphChars.push([0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0]); // 9
		customGlyphChars.push([0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1]); // A
		customGlyphChars.push([1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0]); // B
		customGlyphChars.push([0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1]); // C
		customGlyphChars.push([1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0]); // D
		customGlyphChars.push([1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1]); // E
		customGlyphChars.push([1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0]); // F
		customGlyphChars.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // (empty)

		const drawCustomChar = (destGlyphBitmap, i, baseX, baseY, color) => {
			const charBitmap = customGlyphChars[i];
			for (let y = 0; y < 5; ++y) {
				for (let x = 0; x < 3; ++x) {
					destGlyphBitmap[(baseY + y) * 16 + baseX + x] = charBitmap[y * 3 + x] ? color : 0;
				}
			}
		};

		fonts.textbox = (message, font, altFonts, width, height, bitmap, rocFonts, defaultRocFont, textSpacing) => {
			let bitmapWidth = 256 + 8;
			while (bitmapWidth < width) bitmapWidth *= 2;
			bitmap ??= new Uint32Array(bitmapWidth * 192); // just for working
			bitmap.fill(0xffd6f7ff, 0, bitmap.length);
			let contentWidth = width || 1;
			let baseX = 0;
			let baseY = 0;
			let lineHeight = 16; // ???

			const resize = () => {
				if (bitmapWidth * (baseY + lineHeight + 8) <= bitmap.length) return;

				const newBitmap = new Uint32Array(bitmap.length * 2);
				newBitmap.set(bitmap, 0);
				newBitmap.fill(0xffd6f7ff, bitmap.length, newBitmap.length);
				bitmap = newBitmap;
			};
			resize();

			let currentFont = font;
			let currentReplacementFont = altFonts[0];
			let rocFont = defaultRocFont;
			let darkColor = 0xff314263;
			let shadowColor = 0xffdee6ef;
			let noLetterSpacing = false;
			let textWritten = false;

			const u8 = bufToU8(message);
			for (let o = 0; o < u8.length; ) {
				let glyph;
				const char = u8[o++];
				if (char === 0xff) {
					// formatting
					const control = u8[o++];
					if (control === 0x00) {
						// line break
						baseX = 0;
						baseY += lineHeight + 4;
						lineHeight = 16;
						resize();
					} else if (control === 0x01) {
						// reset text
						++o; // ?
						if (textWritten) {
							baseX = 0;
							baseY += lineHeight + 4;
							lineHeight = 16;
							resize();
							for (let x = 0; x < bitmapWidth; ++x) {
								bitmap[baseY * bitmapWidth + x] = 0xff0099ff;
							}
							++baseY;
							resize();
							textWritten = false;
						}
					} else if (control === 0x0a)
						++o; // close textbox
					else if (control === 0x0b) {
						// new textbox page (may scroll down) TODO doesn't BIS have scrolling textboxes???
						++o; // ?
						if (textWritten) {
							baseX = 0;
							baseY += lineHeight + 4;
							lineHeight = 16;
							resize();
							for (let x = 0; x < bitmapWidth; ++x) {
								const y = [0, 1, 2, 1][x & 3];
								bitmap[(baseY + y) * bitmapWidth + x] = 0xff0099ff;
							}
							baseY += 3;
							resize();
							textWritten = false;
						}
					} else if (control === 0x0c)
						++o; // wait TODO display some placeholder here
					else if (control === 0x0f) {
						// variable display, generate a glyph
						const fine = u8[o++];
						const broad = u8[o++];
						drawCustomChar(variableGlyph.bitmap, fine >> 4, 4, 2, 4);
						drawCustomChar(variableGlyph.bitmap, fine & 0xf, 9, 2, 4);
						drawCustomChar(variableGlyph.bitmap, broad >> 4, 4, 9, 4);
						drawCustomChar(variableGlyph.bitmap, broad & 0xf, 9, 9, 4);
						glyph = variableGlyph;
					} else if (control === 0x11)
						++o; // button prompt TODO show this
					else if (control === 0x20)
						[darkColor, shadowColor] = [0xff314263, 0xffdee6ef]; // default
					else if (control === 0x21)
						[darkColor, shadowColor] = [0xffdee6ef, 0xff3a4252]; // (239,230,222) (82,66,58)
					else if (control === 0x22)
						[darkColor, shadowColor] = [0xff3a4252, 0xff6ba5c5]; // (82,66,58) (197,165,107)
					else if (control === 0x23)
						[darkColor, shadowColor] = [0xff6ba5c5, 0xffa5cee6]; // (197,165,107) (230,206,165)
					else if (control === 0x24)
						[darkColor, shadowColor] = [0xffa5cee6, 0xffd6f7ff]; // (230,206,165) (255,247,214)
					else if (control === 0x25)
						[darkColor, shadowColor] = [0xffd6f7ff, 0xffffffff]; // (255,247,214) (255,255,255)
					else if (control === 0x26)
						[darkColor, shadowColor] = [0xffffffff, 0xff00c500]; // (255,255,255) (0,197,0)
					else if (control === 0x27)
						[darkColor, shadowColor] = [0xff00c500, 0xffdeffe6]; // (0,197,0) (230,255,222)
					else if (control === 0x28)
						[darkColor, shadowColor] = [0xffdeff17, 0xff007bff]; // (230,255,222) (255,123,0)
					else if (control === 0x29)
						[darkColor, shadowColor] = [0xff007bff, 0xffc5e6ff]; // (255,123,0) (255,230,197)
					else if (control === 0x2a)
						[darkColor, shadowColor] = [0xffc5e6ff, 0xffff5a31]; // (255,230,197) (49,90,255)
					else if (control === 0x2b)
						[darkColor, shadowColor] = [0xffff5a31, 0xfff7f7e6]; // (49,90,255) (230,247,247)
					else if (control === 0x2c)
						[darkColor, shadowColor] = [0xfff7f7e6, 0xff0000ff]; // (230,247,247) (255,0,0)
					else if (control === 0x2d)
						[darkColor, shadowColor] = [0xff0000ff, 0xffd6d6ff]; // (255,0,0) (255,214,214)
					else if (control === 0x2e)
						[darkColor, shadowColor] = [0xff0000ff, 0xffd6d6ff]; // (255,0,0) (255,214,214)
					else if (control === 0x2f)
						[darkColor, shadowColor] = [0x00000000, 0xff314263]; // transparent (99,66,49)
					else if (control === 0x40) {
						// normal font
						[currentFont, currentReplacementFont, rocFont] = [font, altFonts[0], defaultRocFont];
					} else if (control === 0x41) {
						// small font
						[currentFont, currentReplacementFont, rocFont] = [altFonts[1], altFonts[2], rocFonts?.[1]];
					} else if (control === 0x42) {
						// big font
						[currentFont, currentReplacementFont, rocFont] = [altFonts[3], altFonts[4], rocFonts?.[2]];
					} else if (0x60 <= control && control <= 0xe0) {
						// TEST DEBUG
						drawCustomChar(variableGlyph.bitmap, control >> 4, 4, 2, 4);
						drawCustomChar(variableGlyph.bitmap, control & 0xf, 9, 2, 4);
						drawCustomChar(variableGlyph.bitmap, 16, 4, 9, 4);
						drawCustomChar(variableGlyph.bitmap, 16, 9, 9, 4);
						glyph = variableGlyph;
					} else if (control === 0xe8) noLetterSpacing = true;
					else if (control === 0xef) noLetterSpacing = false;

					if (!glyph) continue; // some control characters are drawn
				}

				if (char === 0x00) continue; // ?
				if (char === 0x20) {
					baseX += 8;
					continue;
				}

				textWritten = true;

				let code = char;
				if (!glyph) {
					if (char >= 0xf9 && currentReplacementFont) {
						// take from replacement characters
						code = u8[o++];
						if (char === 0xfe) code |= 0;
						else if (char === 0xfd) code |= 0x100;
						else if (char === 0xfc) code |= 0x200;
						else if (char === 0xfb) code |= 0x300;
						else if (char === 0xfa) code |= 0x400;
						else if (char === 0xf9) code |= 0x500;
						glyph = currentReplacementFont.byCode.get(code);
					} else if (char <= 0x08 && rocFont) {
						// ROC square font access
						code = u8[o++];
						if (char === 0x01) code -= 1;
						else if (char === 0x02) code += 0xf8;
						else if (char === 0x03) code += 0x1f1;
						else if (char === 0x04) code += 0x2ea;
						else if (char === 0x05) code += 0x3e3;
						else if (char === 0x06) code += 0x4dc;
						else if (char === 0x07) code += 0x5d5;
						else if (char === 0x08) code += 0x6ce;
						glyph = rocFont.byCode.get(code);
					} else {
						glyph = currentFont?.byCode.get(code);
					}
				}

				if (!glyph) {
					// invalid glyph; generate a symbol
					drawCustomChar(errorGlyph.bitmap, (code >> 8) & 0xf, 2, 3, 3);
					drawCustomChar(errorGlyph.bitmap, (code >> 4) & 0xf, 6, 3, 3);
					drawCustomChar(errorGlyph.bitmap, code & 0xf, 10, 3, 3);
					glyph = errorGlyph;
				}

				if (baseX + glyph.actualWidth > contentWidth) {
					// resize
					contentWidth = Math.min(baseX + glyph.width, width || 256);
					// if exceeding a fixed width, newline first (don't change contentWidth though)
					if (baseX + glyph.width > contentWidth) {
						baseX = 0;
						baseY += lineHeight + 4;
						lineHeight = 16;
						resize();
					}
				}

				if (glyph.height > lineHeight) {
					lineHeight = glyph.height;
					resize();
				}

				for (let y = 0; y < glyph.height; ++y) {
					for (let x = 0; x < glyph.width; ++x) {
						const pos = (baseY + 4 + y) * bitmapWidth + (baseX + 4 + x);
						const pixel = glyph.bitmap[y * glyph.width + x];
						if (pixel === 1) bitmap[pos] = shadowColor;
						else if (pixel === 2) bitmap[pos] = darkColor;
						else if (pixel === 3)
							bitmap[pos] = 0xff0000ff; // debug red
						else if (pixel === 4) bitmap[pos] = 0xffff9900; // debug blue
					}
				}
				baseX += glyph.actualWidth + (noLetterSpacing ? 0 : textSpacing);
			}

			const bitmapHeight = baseY + lineHeight + 4;
			return { bitmap, bitmapWidth, bitmapHeight, actualWidth: contentWidth + 8 };
		};

		const optionFonts = (fonts.optionFonts = []);
		const optionNames = (fonts.optionNames = []);
		if (fsext.font) {
			// not available in JP/ROC
			optionFonts.push(fonts.standard(fsext.font));
			optionNames.push('ARM9 Font');
		}

		const statSegments = unpackSegmentedFile(fs.get('/Font/StatFontSet.dat'), 0, fs.get('/Font/StatFontSet.dat'));
		for (let i = 0; i < statSegments.length; ++i) {
			const u8 = bufToU8(statSegments[i]);
			for (let o = 0; o < u8.length; ++o) {
				if (u8[o]) {
					// only add segments that aren't zero'd out
					optionNames.push(`StatFontSet [${i}]`);
					optionFonts.push(fonts.standard(statSegments[i]));
					break;
				}
			}
		}

		if (fs.has('/Font/11x11.bin')) {
			// ROC only
			optionNames.push('11x11', '12x12', '20x20');
			optionFonts.push(
				fonts.fixed(fs.get('/Font/11x11.bin'), 11, 11, 12, 16, false),
				fonts.fixed(fs.get('/Font/12x12.bin'), 12, 12, 12, 12, true),
				fonts.fixed(fs.get('/Font/20x20.bin'), 20, 20, 20, 20, true),
			);
		}

		const select = dropdown(optionNames, 0, () => update());
		section.appendChild(select);

		const showGlyphWidth = checkbox('Show Glyph Width', true, () => update());
		section.appendChild(showGlyphWidth);

		const alignCharCode = checkbox('Align To Character Codes', false, () => update());
		section.appendChild(alignCharCode);

		const list = document.createElement('div');
		list.style.cssText = 'display: grid; grid-columns: 512px 200px';
		section.appendChild(list);

		const update = () => {
			const font = optionFonts[select.value];
			const { bitmap, bitmapWidth, bitmapHeight } = fonts.preview(
				alignCharCode.checked ? font.byCode : font.byGlyph,
				32,
				showGlyphWidth.checked,
			);

			list.innerHTML = '';

			const canvas = document.createElement('canvas');
			canvas.width = bitmapWidth;
			canvas.height = bitmapHeight;
			canvas.style.cssText = `display: block; width: ${bitmapWidth * 2}px; height: ${bitmapHeight * 2}px;`;

			const ctx = canvas.getContext('2d');
			ctx.putImageData(new ImageData(bufToU8Clamped(bitmap), bitmapWidth, bitmapHeight), 0, 0);

			list.appendChild(canvas);
		};
		update();

		return fonts;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Messages                                                                                             |
	// +---------------------------------------------------------------------------------------------------------------+

	const messages = (window.messages = createSection('Messages', section => {
		const messages = {};

		const columnNamesWithFonts = (c => {
			c[0] = 'CJK replacements';
			c[1] = 'CJK small';
			c[2] = 'CJK small replacements';
			c[3] = 'CJK big';
			c[4] = 'CJK big replacements';
			c[5] = 'English (?)';
			c[6] = 'English small';
			c[7] = 'English (?)';
			c[8] = 'English big';
			c[9] = 'English (?)';
			c[10] = 'French (?)';
			c[11] = 'French small';
			c[12] = 'French (?)';
			c[13] = 'French big';
			c[14] = 'French (?)';
			c[15] = 'German (?)';
			c[16] = 'German small';
			c[17] = 'German (?)';
			c[18] = 'German big';
			c[19] = 'German (?)';
			c[20] = 'Italian (?)';
			c[21] = 'Italian small';
			c[22] = 'Italian (?)';
			c[23] = 'Italian big';
			c[24] = 'Italian (?)';
			c[25] = 'Spanish (?)';
			c[26] = 'Spanish small';
			c[27] = 'Spanish (?)';
			c[28] = 'Spanish big';
			c[29] = 'Spanish (?)';

			c[66] = 'CJK';
			c[67] = 'English';
			c[68] = 'French';
			c[69] = 'German';
			c[70] = 'Italian';
			c[71] = 'Spanish';
			return c;
		})([]);

		const columnNamesWithoutFonts = (c => {
			c[0] = 'CJK';
			c[1] = 'English';
			c[2] = 'French';
			c[3] = 'German';
			c[4] = 'Italian';
			c[5] = 'Spanish';
			return c;
		})([]);

		const options = [
			['/FEvent/FEvent.dat', 'fevent'],
			['/BAI/BMes_cf.dat', 'tables+textboxes+fonts'],
			['/BAI/BMes_ji.dat', 'tables+textboxes+fonts'],
			['/BAI/BMes_yo.dat', 'tables+textboxes+fonts'],
			['/MAI/MMes_yo.dat', 'tables+textboxes+fonts'],
			['/SAI/SMes_yo.dat', 'tables+textboxes+fonts'],
			['/BData/mfset_AItmC.dat', 'plain'], // PIT only?
			['/BData/mfset_AItmE.dat', 'plain'],
			['/BData/mfset_AItmE2.dat', 'plain'],
			['/BData/mfset_AItmN.dat', 'plain'],
			['/BData/mfset_BadgeE.dat', 'plain'],
			['/BData/mfset_BadgeEffectE.dat', 'plain'],
			['/BData/mfset_BadgeN.dat', 'plain'],
			['/BData/mfset_BonusE.dat', 'plain'],
			['/BData/mfset_Help.dat', 'plain'],
			['/BData/mfset_MiniGame.dat', 'plain'],
			['/BData/mfset_MonN.dat', 'plain'],
			['/BData/mfset_RankUpE.dat', 'plain'],
			['/BData/mfset_UItmE.dat', 'plain'],
			['/BData/mfset_UItmE2.dat', 'plain'],
			['/BData/mfset_UItmN.dat', 'plain'],
			['/BData/mfset_WearE.dat', 'plain'],
			['/BData/mfset_WearN.dat', 'plain'],
			['/BDataMiniGame/mfset_MesDat_MiniGame.dat', 'textboxes+fonts'],
			['/EDataSave/mfset_EMesJig.dat', 'textboxes+fonts'],
			['/EDataSave/mfset_EMesOutline.dat', 'textboxes+fonts'],
			['/EDataSave/mfset_EMesPlace.dat', 'textboxes+fonts'],
			['/EDataSave/mfset_EMesSys.dat', 'textboxes+fonts'],
			['/MData/mfset_InitLoadMes.dat', 'textboxes'],
			['/MData/mfset_MenuMes.dat', 'plain'],
			['/MData/mfset_ParamExpMes.dat', 'textboxes'],
			['/MData/mfset_ShopMes.dat', 'textboxes'],
		];

		const optionsContainer = document.createElement('div');
		optionsContainer.style.cssText =
			'position: sticky; top: 0; z-index: 5; background: var(--bg); margin-bottom: 1px;';
		section.appendChild(optionsContainer);

		const fileSelect = dropdown(
			options.map(([name]) => name),
			0,
			() => updateFile(),
		);
		optionsContainer.appendChild(fileSelect);

		let tableSelect = dropdown([''], 0, () => updateTable());
		tableSelect.style.display = 'none';
		optionsContainer.appendChild(tableSelect);

		addHTML(optionsContainer, '<br>');

		const isRoc = fs.has('/Font/11x11.bin');
		let defaultFont = 1;
		if (headers.gamecode === 'CLJJ') defaultFont = isRoc ? 3 : 0;
		else if (headers.gamecode === 'CLJK') defaultFont = 2;

		const gameFont = dropdown(
			['Japanese', 'Latin', 'Korean', 'Chinese', 'Hex View', ...fonts.optionNames.map(x => `Font: ${x}`)],
			defaultFont,
			() => updateTable(),
		);
		optionsContainer.appendChild(gameFont);

		const textSpacing = dropdown(
			['Spacing: 1 (Latin)', 'Spacing: 2 (CJK)'],
			headers.gamecode === 'CLJJ' || headers.gamecode === 'CLJK' ? 1 : 0,
			() => updateTable(),
		);
		optionsContainer.appendChild(textSpacing);

		const rocFont = dropdown(['No ROC Font', 'ROC 11x11', 'ROC 12x12', 'ROC 20x20'], isRoc ? 1 : 0, () =>
			updateTable(),
		);
		if (isRoc) optionsContainer.appendChild(rocFont);

		const textboxScale = dropdown(['Scale: 1x', 'Scale: 1.5x', 'Scale: 2x'], 2, () => updateTable());
		optionsContainer.appendChild(textboxScale);

		const fontTable = document.createElement('table');
		fontTable.className = 'bordered';
		section.appendChild(fontTable);

		const textTableContainer = document.createElement('div');
		textTableContainer.style.cssText = 'overflow-x: auto;';
		section.appendChild(textTableContainer);

		const textTable = document.createElement('table');
		textTable.className = 'bordered';
		textTableContainer.appendChild(textTable);

		let updateTable;
		const updateFile = () => {
			const [path, type] = options[fileSelect.value];
			const container = fs.get(path);

			let showTableOptions = false;
			const tableOptions = [];
			const tables = [];
			if (type === 'fevent') {
				showTableOptions = true;
				for (let i = 0; i * 3 + 2 < fsext.fevent.length; ++i) {
					if (fsext.fevent[i * 3 + 2].byteLength) tableOptions.push(`Room 0x${i.toString(16)}`);
					else tableOptions.push(`<span style="opacity: 0.5;">Room 0x${i.toString(16)}</span>`);

					const innerFile = fsext.fevent[i * 3 + 2];
					tables.push(unpackSegmentedFile(innerFile, 0, innerFile));
				}
			} else if (type === 'tables+textboxes+fonts') {
				showTableOptions = true;
				const segments = unpackSegmentedFile(container, 0, container);
				for (let i = 0; i < segments.length; ++i) {
					// check if nonzero
					let nonzero = false;
					const u8 = bufToU8(segments[i]);
					for (let o = 0; o < u8.length; ++o) {
						if (u8[o]) {
							nonzero = true;
							break;
						}
					}
					if (!nonzero) continue;

					tableOptions.push(`Table 0x${i.toString(16)}`);
					tables.push(unpackSegmentedFile(segments[i], 0, segments[i]));
				}
			} else if (type === 'plain' || type === 'textboxes' || type === 'textboxes+fonts') {
				tables.push(unpackSegmentedFile(container, 0, container)); // treat the entire file as one table
			}

			tableSelect.replaceWith(
				(tableSelect = dropdown(showTableOptions ? tableOptions : [''], 0, () => updateTable())),
			);
			tableSelect.style.display = tableOptions.length ? 'inline-block' : 'none';

			updateTable = () => {
				fontTable.innerHTML = '';
				textTable.innerHTML = '';

				const isSimple = type === 'plain' || type === 'textboxes';

				const columns = (messages.columns = tables[tableSelect.value]);
				const fontColumns = [];
				const textColumns = [];
				for (let i = 0; i < columns.length; ++i) {
					let isNonzero = false;
					const u8 = bufToU8(columns[i]);
					for (let o = 0; o < u8.length; ++o) {
						if (u8[o]) {
							isNonzero = true;
							break;
						}
					}
					if (!isNonzero) continue;

					if (isSimple) {
						// always text
						textColumns.push(i);
					} else {
						// 1-5 = CJK fonts, 6-10 = English fonts, ..., 25-30 = Spanish fonts
						if (i <= 30) fontColumns.push(i);
						else textColumns.push(i);
					}
				}

				const canvasScale = [1, 1.5, 2][textboxScale.value];
				const fontColumnsParsed = new Map();
				for (const columnId of fontColumns) {
					const tr = document.createElement('tr');
					tr.innerHTML = `<th style="text-wrap: nowrap;"><code>[${columnId}]</code>
						${columnNamesWithFonts[columnId]}</th>`;

					const td = document.createElement('td');
					tr.appendChild(td);

					const font = fonts.standard(columns[columnId]);
					fontColumnsParsed.set(columnId, font);
					const { bitmap, bitmapWidth, bitmapHeight } = fonts.preview(font.byGlyph, 32, false);

					const canvas = document.createElement('canvas');
					canvas.width = bitmapWidth;
					canvas.height = bitmapHeight;
					canvas.style.cssText = `width: ${bitmapWidth * canvasScale}px; height: ${bitmapHeight * canvasScale}px;`;
					td.appendChild(canvas);

					const ctx = canvas.getContext('2d');
					ctx.putImageData(new ImageData(bufToU8Clamped(bitmap), bitmapWidth, bitmapHeight), 0, 0);

					fontTable.appendChild(tr);
				}

				let rocFonts, defaultRocFont;
				if (rocFont.value > 0) {
					rocFonts = [
						fonts.fixed(fs.get('/Font/11x11.bin'), 11, 11, 12, 16, false),
						fonts.fixed(fs.get('/Font/12x12.bin'), 12, 12, 12, 12, true),
						fonts.fixed(fs.get('/Font/20x20.bin'), 20, 20, 20, 20, true),
					];
					defaultRocFont = rocFonts[rocFont.value - 1];
				}

				const headerTr = document.createElement('tr');
				headerTr.innerHTML = '<th></th>';
				for (const columnId of textColumns) {
					const title = isSimple ? columnNamesWithoutFonts[columnId] : columnNamesWithFonts[columnId];
					addHTML(headerTr, `<th><code>[${columnId}]</code> ${title}</th>`);
				}
				textTable.appendChild(headerTr);

				const textColumnsSegments = textColumns.map(columnId => [columnId, unpackSegmented32(columns[columnId])]);
				const tableHeight = Math.max(...textColumnsSegments.map(x => x[1].length));
				let recycledBitmap = undefined;
				for (let i = 0; i < tableHeight; ++i) {
					const tr = document.createElement('tr');
					tr.innerHTML = `<th>${i}</th>`;

					for (const [columnId, segments] of textColumnsSegments) {
						let text = segments[i];
						const td = document.createElement('td');
						tr.appendChild(td);
						if (!text) continue;

						if (0 <= gameFont.value && gameFont.value <= 3) {
							if (
								type === 'textboxes' ||
								type === 'textboxes+fonts' ||
								type === 'tables+textboxes+fonts' ||
								type === 'fevent'
							) {
								text = sliceDataView(text, 2, text.byteLength);
							}

							const alphabet = ['japanese', 'latin', 'korean', 'chinese'][gameFont.value];
							td.innerHTML = bisUnicode(text, alphabet).replaceAll('\n', '<br>');
						} else if (gameFont.value === 4) {
							// Hex View
							td.innerHTML = `<code>${bytes(0, text.byteLength, text)}</code>`;
						} else {
							// Use custom font
							const font = fonts.optionFonts[gameFont.value - 5];

							let width = 0,
								height = 0;
							if (
								type === 'textboxes' ||
								type === 'textboxes+fonts' ||
								type === 'tables+textboxes+fonts' ||
								type === 'fevent'
							) {
								width = text.getUint8(0) * 8;
								height = ((text.getUint8(1) - 1) / 2) * 8;
								text = sliceDataView(text, 2, text.byteLength);
							}

							let altFonts = [];
							if (!isSimple) {
								// TOOD: verify
								if (columnId === 67) altFonts = [1, 2, 3, 4, 5];
								else if (columnId === 68) altFonts = [6, 7, 8, 9, 10];
								else if (columnId === 69) altFonts = [11, 12, 13, 14, 15];
								else if (columnId === 70) altFonts = [16, 17, 18, 19, 20];
								else if (columnId === 71) altFonts = [21, 22, 23, 24, 25];
								else if (columnId === 72) altFonts = [26, 27, 28, 29, 30];
								altFonts = altFonts.map(columnId => fontColumnsParsed.get(columnId));
							}

							const { bitmap, bitmapWidth, bitmapHeight, actualWidth } = fonts.textbox(
								text,
								font,
								altFonts,
								width,
								height,
								recycledBitmap,
								rocFonts,
								defaultRocFont,
								[1, 2][textSpacing.value],
							);

							const canvas = document.createElement('canvas');
							canvas.width = actualWidth;
							canvas.height = bitmapHeight;
							canvas.style.cssText = `width: ${actualWidth * canvasScale}px; height: ${bitmapHeight * canvasScale}px;`;

							const ctx = canvas.getContext('2d');
							ctx.putImageData(
								new ImageData(
									bufToU8Clamped(bitmap.slice(0, bitmapWidth * bitmapHeight)),
									bitmapWidth,
									bitmapHeight,
								),
								0,
								0,
							);
							td.appendChild(canvas);

							recycledBitmap = bitmap;
						}
					}

					textTable.appendChild(tr);
				}
			};
			updateTable();
		};
		updateFile();

		return messages;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Monsters                                                                                             |
	// +---------------------------------------------------------------------------------------------------------------+

	const monsters = (window.monsters = createSection('Monsters', section => {
		const monsters = {};

		// basically a rip straight from Yoshi Magic
		const monNFile = fs.get('/BData/mfset_MonN.dat');
		const monsterNameTable = unpackSegmentedFile(monNFile, 0, monNFile).map(buf => unpackSegmented32(buf));

		const table = document.createElement('table');
		table.className = 'bordered';
		section.appendChild(table);

		monsters.monsters = [];
		for (let i = 0; i < fsext.monsters.length; ++i) {
			const block = fsext.monsters[i];
			const nameIndex = block.getUint16(0, true);
			const script = block.getUint16(2, true);
			const sprite = block.getUint32(4, true);
			const level = block.getUint16(8, true);
			const hp = block.getUint16(10, true);
			const pow = block.getUint16(12, true);
			const def = block.getUint16(14, true);
			const spd = block.getUint16(16, true);

			const exp = block.getUint16(0x16, true);
			const coins = block.getUint16(0x18, true);

			let scriptName = `script ${str16(script)}`;
			if (script >> 12 === 2) scriptName = `yo[${script & 0xfff}]`;
			else if (script >> 12 === 4) scriptName = `ji[${script & 0xfff}]`;
			else if (script >> 12 === 7) scriptName = `cf[${script & 0xfff}]`;

			let name;
			if (monsterNameTable[1]?.[nameIndex]) name = bisUnicode(monsterNameTable[1][nameIndex], 'latin');
			else name = bisUnicode(monsterNameTable[0][nameIndex], 'japanese');

			let spriteName = str32(sprite);
			if (sprite >>> 24 === 0xc0) spriteName = `BObjPc[0x${(sprite & 0xffff).toString(16)}]`;
			else if (sprite >>> 24 === 0xc1) spriteName = `BObjMon[0x${(sprite & 0xffff).toString(16)}]`;
			else if (sprite >>> 24 === 0xc2) spriteName = `BObjUI[0x${(sprite & 0xffff).toString(16)}]`;

			addHTML(
				table,
				`<tr>
					<th>${i}</th>
					<td>${name}</td>
					<td>${spriteName}</td>
					<td>${scriptName}</td>
					<td>HP ${hp} / POW ${pow} / DEF ${def} / SPD ${spd}</td>
					<td>EXP ${exp} / Coins ${coins}</td>
				</tr>`,
			);

			monsters.monsters.push({ name, script, sprite, level, hp, pow, def, spd, exp, coins });
		}

		return monsters;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Battle Scripts                                                                                       |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initBai) await waitFor(() => window.initBai);
	window.initBai();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: FX Alls                                                                                              |
	// +---------------------------------------------------------------------------------------------------------------+

	const fxalls = (window.fxalls = createSection('FX Alls', section => {
		const fxalls = {};

		const options = [
			{ label: 'BDfxAll.dat', segments: fsext.battle.get('/BRfx/BDfxAll.dat'), ns: 'DFX' },
			{ label: 'BDfx (lib)', segments: fsext.bdfxlib, ns: 'DFX' },
			{
				// BDfxGAll.dat also uses battle file idx 37, same as BDfxAll
				label: 'BDfxGAll.dat',
				segments: (() => {
					const f = fs.get('/BRfx/BDfxGAll.dat');
					return f && unpackSegmentedFile(f, 0, f);
				})(),
				ns: 'DFX',
			},
			{ label: 'BOfxAll.dat', segments: fsext.battle.get('/BRfx/BOfxAll.dat'), ns: 'OFX' },
			{ label: 'BOfx (lib)', segments: fsext.bofxlib, ns: 'OFX' },
			{ label: 'BLfx (main)', segments: fsext.blfx, ns: 'LFX' },
		];
		const optionSelect = dropdown(options.map(x => x.label), 0, () => updateOption());
		section.appendChild(optionSelect);

		let segmentSelect = dropdown([''], 0, () => {});
		section.appendChild(segmentSelect);

		const prettyPrint = checkbox('Pretty Print', true, () => updateSegment());
		section.appendChild(prettyPrint);

		const preview = document.createElement('div');
		section.appendChild(preview);

		let updateSegment = () => {};

		const updateOption = () => {
			const { label, segments, ns } = options[optionSelect.value];
			if (!segments) {
				preview.innerHTML = 'No segment offsets available for this file';
				return;
			}

			const newDropdown = dropdown(
				segments.map((x, i) => `0x${i.toString(16)} (len ${x.byteLength})`),
				0,
				() => updateSegment(),
			);
			segmentSelect.replaceWith((segmentSelect = newDropdown));

			updateSegment = () => {
				preview.innerHTML = '';
				const segment = segments[segmentSelect.value];

				const parsed = rfx.parse(segment);
				const ul = document.createElement('ul');
				for (let i = 0; i < parsed.length; ++i) {
					if (!parsed[i]) {
						addHTML(ul, `<li><code>[${i}]</code> (empty)</li>`);
						continue;
					}

					if (ns === 'DFX') rfx.dfxDecorateTrack(parsed[i]);
					else rfx.defaultDecorateTrack(parsed[i], ns);

					const li = document.createElement('li');
					li.innerHTML = `<code>[${i}]</code>`;
					for (const el of rfx.trackToHtml(parsed[i])) {
						addHTML(li, ' ');
						li.appendChild(el);
					}

					ul.appendChild(li);
				}

				preview.appendChild(ul);
			};
			updateSegment();
		};
		updateOption();

		return fxalls;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: FX Sprites                                                                                           |
	// +---------------------------------------------------------------------------------------------------------------+

	const fxsprites = (window.fxsprites = createSection('FX Sprites', section => {
		const fxsprites = {};

		const files = [
			{ label: 'BDfx', pals: fsext.battle.get('/BRfx/BDfxPal.dat'), texs: fsext.battle.get('/BRfx/BDfxTex.dat') },
			{ label: 'BLfx', pals: undefined, texs: fsext.battle.get('/BRfx/BLfxTex.dat') },
			{ label: 'BOfx', pals: fsext.battle.get('/BRfx/BOfxPal.dat'), texs: fsext.battle.get('/BRfx/BOfxTex.dat') },
			{ label: 'FDfx', pals: fsext.fdfxpal, texs: fsext.fdfxtex },
			{ label: 'FOfx', pals: fsext.fofxpal, texs: fsext.fofxtex },
			{
				label: 'MDfx',
				pals: unpackSegmentedFile(fs.get('/MRfx/MDfxPal.dat'), 0, fs.get('/MRfx/MDfxPal.dat')),
				texs: unpackSegmentedFile(fs.get('/MRfx/MDfxTex.dat'), 0, fs.get('/MRfx/MDfxTex.dat')),
			},
			{
				label: 'MOfx',
				pals: unpackSegmentedFile(fs.get('/MRfx/MOfxPal.dat'), 0, fs.get('/MRfx/MOfxPal.dat')),
				texs: unpackSegmentedFile(fs.get('/MRfx/MOfxTex.dat'), 0, fs.get('/MRfx/MOfxTex.dat')),
			},
		];
		const fileSelect = dropdown(
			files.map(x => x.label),
			0,
			() => updateFile(),
		);
		section.appendChild(fileSelect);

		let segmentSelect = dropdown([''], 0, () => {});
		section.appendChild(segmentSelect);

		const scaleSelect = dropdown(['Scale: 1x', 'Scale: 2x', 'Scale: 3x', 'Scale: 4x'], 0, () => updateTexture());
		section.appendChild(scaleSelect);

		const paletteRowOptions = [];
		for (let i = 0; i < 16; ++i) paletteRowOptions.push(`Pal Row: 0x${i.toString(16)}`);
		const paletteRowSelect = dropdown(paletteRowOptions, 0, () => updateTexture());
		section.appendChild(paletteRowSelect);

		const forceFallbackPalette = checkbox('Force Fallback Palette', false, () => updateTexture());
		section.appendChild(forceFallbackPalette);

		const metaTop = document.createElement('div');
		section.appendChild(metaTop);

		const preview = document.createElement('div');
		preview.style.cssText = 'position: relative; height: calc(20px + 128px);';
		section.appendChild(preview);

		const paletteCanvas = document.createElement('canvas');
		const paletteCtx = paletteCanvas.getContext('2d');
		paletteCanvas.style.cssText = `position: absolute; top: 0; left: 0; height: 128px; width: 128px;`;
		paletteCanvas.width = 16;
		paletteCanvas.height = 16;
		preview.appendChild(paletteCanvas);

		const textureCanvas = document.createElement('canvas');
		const textureCtx = textureCanvas.getContext('2d');
		textureCanvas.style.cssText = `position: absolute; top: 0; left: 128px; height: 256px; width: 192px;`;
		textureCanvas.width = 256;
		textureCanvas.height = 192;
		preview.appendChild(textureCanvas);

		const meta = document.createElement('div');
		section.appendChild(meta);

		const fallbackPaletteU16 = new Uint16Array(256);
		for (let row = 0; row < 16; ++row) {
			fallbackPaletteU16.set(
				[
					0,
					31 | (0 << 5) | (row << 11),
					31 | (8 << 5) | (row << 11),
					31 | (16 << 5) | (row << 11),
					31 | (24 << 5) | (row << 11),
					31 | (31 << 5) | (row << 11),
					(row << 1) | (31 << 5) | (0 << 10),
					(row << 1) | (31 << 5) | (8 << 10),
					(row << 1) | (31 << 5) | (16 << 10),
					(row << 1) | (31 << 5) | (24 << 10),
					(row << 1) | (31 << 5) | (31 << 10),
					0 | (row << 6) | (31 << 10),
					8 | (row << 6) | (31 << 10),
					16 | (row << 6) | (31 << 10),
					24 | (row << 6) | (31 << 10),
					31 | (row << 6) | (31 << 10),
				],
				row * 16,
			);
		}
		const fallbackPaletteU32 = rgb15To32(fallbackPaletteU16);

		let updateSegment = () => {};
		let updateTexture = () => {};

		const updateFile = () => {
			const { label, pals, texs } = files[fileSelect.value];
			if (!pals?.length && !texs?.length) {
				meta.innerHTML = '';
				preview.style.display = 'none';
				metaTop.innerHTML = `No palette offsets or texture offsets available`;
				segmentSelect.style.display = 'none';
				updateSegment = () => {};
				updateTexture = () => {};
				return;
			}

			// textures are required, palettes are optional
			const palettesById = new Map();
			if (pals) {
				for (let i = 0; i < pals.length; ++i) {
					if (pals[i].byteLength !== 516) continue;
					palettesById.set(pals[i].getUint32(0, true), sliceDataView(pals[i], 4, 516));
				}
			}

			const options = [];
			for (let i = 0; i < texs.length; ++i) {
				if (texs[i].byteLength < 8) continue;
				options.push([`Texture 0x${i.toString(16)}`, i]);
			}
			segmentSelect.replaceWith(
				(segmentSelect = dropdown(
					options.map(x => x[0]),
					0,
					() => updateSegment(),
				)),
			);

			updateSegment = () => {
				metaTop.innerHTML = '';
				meta.innerHTML = '';
				const id = options[segmentSelect.value][1];

				// the compressed textures can expand to 0 bytes
				const texCompressed = texs[id];
				const tex = texCompressed.byteLength ? lzBis(texCompressed) : undefined;
				if (!tex?.byteLength) {
					addHTML(metaTop, `Texture 0x${id.toString(16)} is empty`);
					preview.style.display = 'none';
					updateTexture = () => {};
					return;
				}
				preview.style.display = '';

				const width = tex.getUint8(0);
				const height = tex.getUint8(1);
				const bitDepth = tex.getUint8(2);
				const unknown = tex.getUint8(3);
				const paletteId = tex.getUint32(4, true);
				addHTML(metaTop, `<div>${width}x${height} / ${bitDepth}bpp / pal 0x${paletteId.toString(16)}</div>`);

				const fallbackPaletteWarning = document.createElement('div');
				fallbackPaletteWarning.style.cssText = 'color: var(--red); display: none';
				fallbackPaletteWarning.textContent = 'Palette not found, using fallback palette';
				metaTop.appendChild(fallbackPaletteWarning);

				updateTexture = () => {
					let palU32;
					if (forceFallbackPalette.checked) {
						palU32 = fallbackPaletteU32;
					} else {
						const palDat = palettesById.get(paletteId);
						if (palDat) {
							fallbackPaletteWarning.style.display = 'none';
							palU32 = rgb15To32(bufToU16(palDat));
						} else {
							fallbackPaletteWarning.style.display = '';
							palU32 = fallbackPaletteU32;
						}
					}

					paletteCtx.putImageData(new ImageData(bufToU8Clamped(palU32), 16, 16), 0, 0);

					const scale = [1, 2, 3, 4][scaleSelect.value];
					textureCanvas.width = width * 8;
					textureCanvas.height = height * 8;
					textureCanvas.style.width = `${width * 8 * scale}px`;
					textureCanvas.style.height = `${height * 8 * scale}px`;
					preview.style.height = `${Math.max(height * 8 * scale, 128) + 20}px`;

					const paletteOffset = paletteRowSelect.value << 4;
					const bitmapU32 = new Uint32Array(width * height * 64);
					let o = 8;
					const texU8 = bufToU8(tex);
					for (let tileY = 0; tileY < height; ++tileY) {
						for (let tileX = 0; tileX < width; ++tileX) {
							const basePos = tileY * 8 * width * 8 + tileX * 8;
							if (bitDepth === 4) {
								for (let i = 0; i < 32; ++i) {
									const pos = basePos + (i >> 2) * width * 8 + ((i & 3) << 1);
									const composite = texU8[o++];
									bitmapU32[pos] = palU32[(composite & 0xf) + paletteOffset] ?? 0;
									bitmapU32[pos ^ 1] = palU32[(composite >> 4) + paletteOffset] ?? 0;
								}
							} else if (bitDepth === 8) {
								for (let i = 0; i < 64; ++i) {
									const pos = basePos + (i >> 3) * width * 8 + (i & 7);
									bitmapU32[pos] = palU32[texU8[o++] + paletteOffset] ?? 0;
								}
							}
						}
					}

					textureCtx.putImageData(new ImageData(bufToU8Clamped(bitmapU32), width * 8, height * 8), 0, 0);
				};
				updateTexture();
			};
			updateSegment();
		};
		updateFile();

		return fxalls;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Disassembler                                                                                         |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initDisassembler) await waitFor(() => window.initDisassembler);
	window.initDisassembler();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: RTTI VTables                                                                                         |
	// | Section: RTTI Inheritance Trees                                                                               |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initRtti) await waitFor(() => window.initRtti);
	window.initRtti();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Sound Data (very unfinished)                                                                         |
	// +---------------------------------------------------------------------------------------------------------------+

	const sound = (window.sound = createSection('Sound (very unfinished)', section => {
		const sound = {};

		const soundFile = fs.get('/Sound/sound_data.sdat');

		const symbStart = soundFile.getUint32(0x10, true);
		const symbLength = soundFile.getUint32(0x14, true);
		const symbDat = (sound.symbDat = sliceDataView(soundFile, symbStart, symbStart + symbLength));

		const infoStart = soundFile.getUint32(0x18, true);
		const infoLength = soundFile.getUint32(0x1c, true);
		const infoDat = (sound.infoDat = sliceDataView(soundFile, infoStart, infoStart + infoLength));

		const fatStart = soundFile.getUint32(0x20, true);
		const fatLength = soundFile.getUint32(0x24, true);
		const fatDat = (sound.fatDat = sliceDataView(soundFile, fatStart, fatStart + fatLength));

		const fileStart = soundFile.getUint32(0x28, true);
		const fileLength = soundFile.getUint32(0x2c, true);
		const fileDat = (sound.fileDat = sliceDataView(soundFile, fileStart, fileStart + fileLength));

		window.infoDat = infoDat;
		window.symbDat = symbDat;
		window.fatDat = fatDat;
		window.fileDat = fileDat;

		// symb block
		const symbFileList = o => {
			const length = symbDat.getUint32(o, true);
			const files = [];
			for (let i = 0; i < length; ++i) files.push(latin1(symbDat.getUint32(o + i * 4, true), undefined, symbDat));
			return files;
		};
		const symbFolderList = o => {
			const length = symbDat.getUint32(o, true);
			const folders = [];
			for (let i = 0; i < length; ++i) {
				const name = latin1(symbDat.getUint32(o + 4 + i * 8, true), undefined, symbDat);
				const files = symbFileList(symbDat.getUint32(o + 8 + i * 8, true));
				folders.push([name, files]);
			}
			return folders;
		};
		const symb = {};
		symb.sseq = symbFileList(symbDat.getUint32(8, true));
		symb.ssar = symbFolderList(symbDat.getUint32(12, true));
		symb.bank = symbFileList(symbDat.getUint32(16, true));
		symb.swar = symbFileList(symbDat.getUint32(20, true));
		symb.player = symbFileList(symbDat.getUint32(24, true));
		symb.group = symbFileList(symbDat.getUint32(28, true));
		symb.player2 = symbFileList(symbDat.getUint32(32, true));
		symb.strm = symbFileList(symbDat.getUint32(36, true));

		// LET"S try this again
		sound.names = [];
		const symbSseqOffset = symbDat.byteLength ? symbDat.getUint32(8, true) : 0;
		const infoSseqOffset = infoDat.getUint32(8, true);
		const infoSseqLength = infoDat.getUint32(infoSseqOffset, true);
		for (let i = 0; i < infoSseqLength; ++i) {
			const offset = infoDat.getUint32(infoSseqOffset + 4 + i * 4, true);
			const segment = sliceDataView(infoDat, offset, offset + 12);
			const fatId = segment.getUint16(0, true);
			const bank = segment.getUint16(4, true);
			const volume = segment.getUint8(6);
			const cpr = segment.getUint8(7);
			const ppr = segment.getUint8(8);
			const ply = segment.getUint8(9);

			let name = '';
			if (symbDat.byteLength) {
				const nameOffset = symbDat.getUint32(symbSseqOffset + 4 + i * 4, true);
				name = latin1(nameOffset, undefined, symbDat);
			}

			sound.names[i] = name;
			let html = `sseq[${i}] : ${name} (fatId ${fatId}) (bank ${bank}) (volume ${volume}) (cpr ${cpr}) (ppr ${ppr}) (ply ${ply});`;
			if (12 + fatId * 16 + 8 <= fatDat.byteLength) {
				const fileStart = fatDat.getUint32(12 + fatId * 16, true);
				const fileSize = fatDat.getUint32(12 + fatId * 16 + 4, true);
				html += ` (fileStart 0x${str32(fileStart)}) (fileSize 0x${fileSize.toString(16)})`;
			}
			addHTML(section, `<div><code>${html}</code></div>`);
		}

		return sound;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Object Palette Animations (very unfinished)                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const objpalanim = (window.objpalanim = createSection('Object Palette Animations (very unfinished)', section => {
		const objpalanim = {};

		const fileSelect = dropdown(['FObj'], 0, () => updateFile());
		section.appendChild(fileSelect);

		const table = document.createElement('table');
		table.style.cssText = 'border-collapse: collapse;';
		section.appendChild(table);

		const updateFile = () => {
			let paletteTable, segmentsTable;
			if (fileSelect.value === 0) ((paletteTable = fsext.fobjPalettes), (segmentsTable = fsext.fobj));

			if (!paletteTable) {
				table.innerHTML = "<tr><td>This entry doesn't exist in fpaf</td></tr>";
				return;
			}

			table.innerHTML = '';
			for (let i = 0; i < paletteTable.length; ++i) {
				const palAnimIndex = paletteTable[i].getInt16(2, true);
				if (palAnimIndex === -1) continue;

				const bigSeg = fsext.fobj[palAnimIndex];
				let segments;
				try {
					segments = unpackSegmented16(bigSeg);
				} catch (err) {
					addHTML(
						table,
						`<tr style="border-bottom: 1px solid var(--line);">
							<td><code>${i}</code></td>
							<td style="padding: 10px 0;"><code>${bytes(0, bigSeg.byteLength, bigSeg)}</code></td>
						</tr>`,
					);
					continue;
				}


				const items = [`<li><code>${bytes(0, segments[0].byteLength, segments[0])}</code></li>`];
				for (let i = 1; i < segments.length - 1; ++i) {
					try {
						items.push(`<li><code>${fpaf.stringify([segments[i]]).join('<br>')}</code></li>`);
					} catch (err) {
						items.push(`<li><code>${bytes(0, segments[i].byteLength, segments[i])}</code></li>`);
					}
				}

				addHTML(
					table,
					`<tr style="border-bottom: 1px solid var(--line);">
						<td><code>${i} (s${palAnimIndex})</code></td>
						<td style="padding: 10px 0;"><ul>${items.join('')}</ul></td>
					</tr>`,
				);
			}
		};
		updateFile();

		return objpalanim;
	}));

	// add spacing to the bottom of the page, for better scrolling
	addHTML(document.body, '<div style="height: 100vh;"></div>');

	// devtools console help
	const loadingEnd = performance.now();
	console.log(
		`File read in ${sectionLoadingStart - fileLoadingStart} ms; loaded in ${loadingEnd - sectionLoadingStart} ms`,
	);

	console.log(
		`Dumping functions: \
		\n%clatin1(off, len, dat) \nbytes(off, len, dat) \nbits(off, len, dat) \
		\ndownload(name, dat, mime = 'application/octet-stream') %c \
		\n\nCompression/Packing functions: \
		\n%cblz(indat) \nblzCompress(indat, minimumSize?) \nlzBis(indat) \nlzBisCompress(indat, blockSize = 512) \
		\nzipStore(files) \nunpackSegmentedFile(headerDat, offset, fileDat) \nunpackSegmented32(dat) \
		\nunpackSegmented16(dat) %c \
		\n\nView functions: \
		\n%csliceDataView(dat, start, end) \nbufToU8(buf) \nbufToU8Clamped(buf) \nbufToU16(buf) \nbufToS16(buf) \
		\nbufToU32(buf) \nbufToDat(buf) \nstr8(x) \nstr16(x) \nstr32(x) %c \
		\n\nSections: \
		\n%cheaders fs ovt fsext fpaf field fmapdataTiles battle battleGiant menu font messages monsters bai fxalls fxsprites disassembler rtti vtables sound objpalanim %c \
		\n\nFile: %cfile%c`,
		'color: #98f;',
		'color: unset;',
		'color: #98f;',
		'color: unset;',
		'color: #98f;',
		'color: unset;',
		'color: #98f;',
		'color: unset;',
		'color: #98f;',
		'color: unset;',
	);
})();
