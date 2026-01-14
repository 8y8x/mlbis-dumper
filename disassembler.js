window.initDisassembler = () => {
	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Disassembler                                                                                         |
	// +---------------------------------------------------------------------------------------------------------------+

	const disassembler = (window.disassembler = createSection('Disassembler', (section) => {
		const disassembler = {};

		const options = [
			'Select an overlay',
			`arm9 entry (len ${fs.arm9.byteLength})`,
			`arm7 entry (len ${fs.arm7.byteLength})`,
		];
		for (const entry of fs.overlayEntries.values()) {
			const file = fs.get(entry.fileId);
			options.push(`${String(entry.id).padStart(4, '0')} (len ${entry.ramSize})`);
		}
		const select = dropdown(options, 0, () => update(), undefined, true);
		section.appendChild(select);

		const setSelect = dropdown(
			['ARM9 (ARMv5TE)', 'ARM7 (ARMv4T)', 'Thumb (ARMv5TE)', 'Thumb (ARMv4T)'],
			0,
			() => update(),
			undefined,
			true,
		);
		section.appendChild(setSelect);

		const display = document.createElement('div');
		section.appendChild(display);

		// see figure A3.2.1
		const conds = [
			'eq',
			'ne',
			'hs',
			'lo',
			'mi',
			'pl',
			'vs',
			'vc',
			'hi',
			'ls',
			'ge',
			'lt',
			'gt',
			'le',
			'',
			'(UNCONDITIONAL)',
		].map((x) => `<span style="color: #d7c;">${x}</span>`);
		const imm = (x) => (x <= -10 ? '-0x' + (-x).toString(16) : x <= 10 ? x : '0x' + x.toString(16));
		const unpredictable = (c) => (c ? ' <span style="color: #e96;">(UNPREDICTABLE)</span>' : '');

		/** `style` can be 'object' or 'asm' */
		const disassembleArm = (disassembler.arm = (overlay, style, isArmv5) => {
			const OBJECT = style === 'object';
			const ASM = style === 'asm';

			const u32 = bufToU32(overlay);
			const lines = [];

			const r = [
				'r0',
				'r1',
				'r2',
				'r3',
				'r4',
				'r5',
				'r6',
				'r7',
				'r8',
				'r9',
				'r10',
				'r11',
				'r12',
				'sp',
				'lr',
				'pc',
			];

			// see section A5.1
			const shifterOperand = (inst) => {
				// used to detect unpredictability
				const Rn = (inst >>> 16) & 0xf;
				const Rd = (inst >>> 12) & 0xf;

				// immediate (A5.1.3)
				if ((inst & 0x0e000000) === 0x02000000) {
					// OK
					const rotateImm = (inst >>> 8) & 0xf;
					const immed = inst & 0xff;
					if (ASM) return `#${imm((immed >> (rotateImm * 2)) | (immed << (32 - rotateImm * 2)))}`;
				}

				// register OR logical shift left by immediate (A5.1.4, A5.1.5)
				if ((inst & 0x0e000070) === 0) {
					const shiftImm = (inst >>> 7) & 0x1f;
					const Rm = inst & 0xf;
					if (shiftImm === 0) {
						if (ASM) return r[Rm]; // A5.1.4 is encoded as a LSL by zero
					} else {
						if (ASM) return `${r[Rm]}, lsl #${imm(shiftImm)}`;
					}
				}

				// logical shift left by register (A5.1.6)
				if ((inst & 0x0e0000f0) === 0x00000010) {
					const Rs = (inst >>> 8) & 0xf;
					const Rm = inst & 0xf;
					const u = unpredictable(Rd === 15 || Rm === 15 || Rn === 15 || Rs === 15);
					if (ASM) return `${r[Rm]}, lsl ${r[Rs]}` + u;
				}

				// logical shift right by immediate (A5.1.7)
				if ((inst & 0x0e000070) === 0x00000020) {
					const shiftImm = (inst >>> 7) & 0x1f;
					const Rm = inst & 0xf;
					if (ASM) return `${r[Rm]}, lsr #${imm(shiftImm || 32)}`;
				}

				// logical shift right by register (A5.1.8)
				if ((inst & 0x0e0000f0) === 0x00000030) {
					const Rs = (inst >>> 8) & 0xf;
					const Rm = inst & 0xf;
					const u = unpredictable(Rd === 15 || Rm === 15 || Rn === 15 || Rs === 15);
					if (ASM) return `${r[Rm]}, lsr ${r[Rs]}` + u;
				}

				// arithmetic shift right by immediate (A5.1.9)
				if ((inst & 0x0e000070) === 0x00000040) {
					const shiftImm = (inst >>> 7) & 0x1f;
					const Rm = inst & 0xf;
					if (ASM) return `${r[Rm]}, asr #${imm(shiftImm || 32)}`;
				}

				// arithmetic shift right by register (A5.1.10)
				if ((inst & 0x0e0000f0) === 0x00000050) {
					const Rs = (inst >>> 8) & 0xf;
					const Rm = inst & 0xf;
					const u = unpredictable(Rd === 15 || Rm === 15 || Rn === 15 || Rs === 15);
					if (ASM) return `${r[Rm]}, asr ${r[Rs]}` + u;
				}

				// rotate right by immediate (A5.1.11)
				if ((inst & 0x0e000070) === 0x00000060) {
					const shiftImm = (inst >>> 7) & 0x1f;
					const Rm = inst & 0xf;
					if (shiftImm !== 0) {
						// shiftImm === 0 is RRX
						if (ASM) return `${r[Rm]}, ror #${imm(shiftImm)}`;
					}
				}

				// rotate right by register (A5.1.12)
				if ((inst & 0x0e0000f0) === 0x00000070) {
					const Rs = (inst >>> 8) & 0xf;
					const Rm = inst & 0xf;
					const u = unpredictable(Rn === 15 || Rd === 15 || Rs === 15 || Rm === 15);
					if (ASM) return `${r[Rm]}, ror ${r[Rs]}` + u;
				}

				// rotate right with extend (A5.1.13)
				if ((inst & 0x0e000ff0) === 0x00000060) {
					const Rm = inst & 0xf;
					if (ASM) return `${r[Rm]}, rrx`;
				}

				// undefined (or it might not be a data processing instruction)
				return;
			};

			// see section A5.2
			const loadAddressingMode = (inst) => {
				const U = (inst >>> 23) & 1;
				const Rn = (inst >>> 16) & 0xf;

				// immediate offset (A5.2.2)
				if ((inst & 0x0f200000) === 0x05000000) {
					const offset = inst & 0xfff;
					if (ASM) return `[${r[Rn]}, #${U ? '+' : '-'}${imm(offset)}]`;
				}

				// register offset (A5.2.3) (encoded as a LSL 0 from A5.2.4)
				if ((inst & 0x0f200ff0) === 0x07000000) {
					const Rm = inst & 0xf;
					const u = unpredictable(Rm === 15);
					if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}]` + u;
				}

				// scaled register offset (A5.2.4)
				if ((inst & 0x0f200010) === 0x07000000) {
					const shiftImm = (inst >>> 7) & 0x1f;
					const shift = (inst >>> 5) & 3;
					const Rm = inst & 0xf;
					const u = unpredictable(Rm === 15);
					if (shift === 0b00) {
						if (shiftImm !== 0) {
							// the 0 case is handled in A5.2.3
							if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}, lsl #${imm(shiftImm)}]` + u;
						}
					} else if (shift === 0b01) {
						if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}, lsr #${imm(shiftImm || 32)}]` + u;
					} else if (shift === 0b10) {
						if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}, asr #${imm(shiftImm || 32)}]` + u;
					} /* (shift === 0b11) */ else {
						if (shiftImm === 0) {
							if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}, rrx]` + u;
						} else {
							if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}, ror #${imm(shiftImm)}]` + u;
						}
					}
				}

				// immediate pre-indexed (A5.2.5)
				if ((inst & 0x0f200000) === 0x05200000) {
					const offset = inst & 0xfff;
					const u = unpredictable(Rn === 15);
					if (ASM) return `[${r[Rn]}, #${U ? '+' : '-'}${imm(offset)}]!` + u;
				}

				// register pre-indexed (A5.2.6) (encoded as a LSL 0 from A5.2.7)
				if ((inst & 0x0f200ff0) === 0x07200000) {
					const Rm = inst & 0xf;
					const u = unpredictable(Rm === 15 || Rn === 15 || Rm === Rn);
					if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}]!` + u;
				}

				// scaled register pre-indexed (A5.2.7)
				if ((inst & 0x0f200010) === 0x07200000) {
					const shiftImm = (inst >>> 7) & 0x1f;
					const shift = (inst >>> 5) & 3;
					const Rm = inst & 0xf;
					const u = unpredictable(Rm === 15 || Rn === 15 || Rm === Rn);
					if (shift === 0b00) {
						if (shiftImm !== 0) {
							// the 0 case is handled in A5.2.6
							if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}, lsl #${imm(shiftImm)}]!` + u;
						}
					} else if (shift === 0b01) {
						if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}, lsr #${imm(shiftImm || 32)}]!` + u;
					} else if (shift === 0b10) {
						if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}, asr #${imm(shiftImm || 32)}]!` + u;
					} /* (shift === 0b11) */ else {
						if (shift === 0) {
							if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}, rrx]!` + u;
						} else {
							if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}, ror #${imm(shiftImm)}]!` + u;
						}
					}
				}

				// immediate post-indexed (A5.2.8)
				if ((inst & 0x0f200000) === 0x04000000) {
					const offset = inst & 0xfff;
					const u = unpredictable(Rn === 15);
					if (ASM) return `[${r[Rn]}], #${U ? '+' : '-'}${imm(offset)}`;
				}

				// register post-indexed (A5.2.9) (encoded as a LSL from A5.2.10)
				if ((inst & 0x0f200ff0) === 0x06000000) {
					const Rm = inst & 0xf;
					const u = unpredictable(Rm === 15 || Rn === 15 || Rm === Rn);
					if (ASM) return `[${r[Rn]}], ${U ? '+' : '-'}${r[Rm]}` + u;
				}

				// register post-indexed (A5.2.10)
				if ((inst & 0x0f200010) === 0x06000000) {
					const shiftImm = (inst >>> 7) & 0x1f;
					const shift = (inst >>> 5) & 3;
					const Rm = inst & 0xf;
					const u = unpredictable(Rm === 15 || Rn === 15 || Rm === Rn);
					if (shift === 0b00) {
						if (shiftImm !== 0) {
							// the 0 case is handled in A5.2.9
							if (ASM) return `[${r[Rn]}], ${U ? '+' : '-'}${r[Rm]}, lsl #${imm(shiftImm)}` + u;
						}
					} else if (shift === 0b01) {
						if (ASM) return `[${r[Rn]}], ${U ? '+' : '-'}${r[Rm]}, lsr #${imm(shiftImm || 32)}` + u;
					} else if (shift === 0b10) {
						if (ASM) return `[${r[Rn]}], ${U ? '+' : '-'}${r[Rm]}, asr #${imm(shiftImm || 32)}` + u;
					} /* (shift == 0b11) */ else {
						if (shiftImm === 0) {
							if (ASM) return `[${r[Rn]}], ${U ? '+' : '-'}${r[Rm]}, rrx` + u;
						} else {
							if (ASM) return `[${r[Rn]}], ${U ? '+' : '-'}${r[Rm]}, ror #${imm(shiftImm)}` + u;
						}
					}
				}

				// could be undefined?
				return;
			};

			// see section A5.3
			const loadMiscAddressingMode = (inst) => {
				const Rn = (inst >>> 16) & 0xf;
				const U = (inst >>> 23) & 1;

				// immediate offset (A5.3.2)
				if ((inst & 0x0f600090) === 0x01400090) {
					const offset = (((inst >>> 8) & 0xf) << 4) | (inst & 0xf);
					if (ASM) {
						if (offset === 0) return `[${r[Rn]}]`;
						else return `[${r[Rn]}, #${U ? '+' : '-'}${imm(offset)}]`;
					}
				}

				// register offset (A5.3.3)
				if ((inst & 0x0f600090) === 0x01000090) {
					const Rm = inst & 0xf;
					const u = unpredictable((inst >>> 8) & 0xf || Rm === 15); // should-be-zero
					if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}]` + u;
				}

				// immediate pre-indexed (A5.3.4)
				if ((inst & 0x0f600090) === 0x01600090) {
					const offset = (((inst >>> 8) & 0xf) << 4) | (inst & 0xf);
					const u = unpredictable(Rn === 15);
					if (ASM) return `[${r[Rn]}, #${U ? '+' : '-'}${imm(offset)}]!` + u;
				}

				// register pre-indexed (A5.3.5)
				if ((inst & 0x0f600090) === 0x01200090) {
					const Rm = inst & 0xf;
					const u = unpredictable(Rm === 15 || Rn === 15 || Rm === Rn);
					if (ASM) return `[${r[Rn]}, ${U ? '+' : '-'}${r[Rm]}]!` + u;
				}

				// immediate post-indexed (A5.3.6)
				if ((inst & 0x0f600090) === 0x00400090) {
					const offset = (((inst >>> 8) & 0xf) << 4) | (inst & 0xf);
					const u = unpredictable(Rn === 15);
					if (ASM) return `[${r[Rn]}], #${U ? '+' : '-'}${imm(offset)}` + u;
				}

				// register post-indexed (A5.3.7)
				if ((inst & 0x0f600090) === 0x00000090) {
					const Rm = inst & 0xf;
					const u = unpredictable(Rm === 15 || Rn === 15 || Rm === Rn);
					if (ASM) return `[${r[Rn]}], ${U ? '+' : '-'}${r[Rm]}` + u;
				}

				// could be undefined?
				return;
			};

			// see section A5.4
			const loadMultipleAddressingMode = (inst) => {
				const P = (inst >>> 24) & 1;
				const U = (inst >>> 23) & 1;

				// increment after (A5.4.2)
				if (!P && U) {
					if (ASM) return 'ia';
				}

				// increment before (A5.4.3)
				if (P && U) {
					if (ASM) return 'ib';
				}

				// decrement after (A5.4.4)
				if (!P && !U) {
					if (ASM) return 'da';
				}

				// decrement before (A5.4.5)
				if (P && !U) {
					if (ASM) return 'db';
				}
			};

			// see section A5.5
			const coprocessorAddressingMode = (inst) => {
				const P = (inst >>> 24) & 1;
				const U = (inst >>> 23) & 1;
				const N = (inst >>> 22) & 1;
				const W = (inst >>> 21) & 1;
				const Rn = (inst >>> 16) & 0xf;
				const offset = inst & 0xff;

				// immediate offset (A5.5.2)
				if (P && !W) {
					if (ASM) return `[${r[Rn]}, #${U ? '+' : '-'}${imm(offset)} * 4]`;
				}

				// immediate pre-indexed (A5.5.3)
				if (P && W) {
					const u = unpredictable(Rn === 15);
					if (ASM) return `[${r[Rn]}, #${U ? '+' : '-'}${imm(offset)} * 4]!` + u;
				}

				// immediate post-indexed (A5.5.4)
				if (!P && W) {
					const u = unpredictable(Rn === 15);
					if (ASM) return `[${r[Rn]}], #${U ? '+' : '-'}${imm(offset)} * 4` + u;
				}

				// unindexed (A5.5.5)
				if (!P && !W) {
					const u = unpredictable(Rn === 15 || !U);
					if (ASM) return `[${r[Rn]}], {${imm(offset)}}` + u;
				}
			};

			for (let i = 0; i < u32.length; ++i) {
				const inst = u32[i];
				const cond = conds[inst >>> 28]; // used in almost all instructions

				// ADC (A4.1.2)
				if ((inst & 0x0de00000) === 0x00a00000 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					if (shifter) {
						if (ASM) lines.push(`adc${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rn]}, ${shifter}`);
						continue;
					}
				}

				// ADD (A4.1.3)
				if ((inst & 0x0de00000) === 0x00800000 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					if (shifter) {
						if (ASM) lines.push(`add${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rn]}, ${shifter}`);
						continue;
					}
				}

				// AND (A4.1.4)
				if ((inst & 0x0de00000) === 0 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					if (shifter) {
						if (ASM) lines.push(`and${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rn]}, ${shifter}`);
						continue;
					}
				}

				// B, BL (A4.1.5)
				if ((inst & 0x0e000000) === 0x0a000000 && cond !== conds[0b1111]) {
					const L = (inst >>> 24) & 1;
					const immed = (inst & 0xffffff) - (inst & 0x800000) * 2; // signed
					if (ASM) lines.push(`b${L ? 'l' : ''}${cond} ${imm(immed)}`);
					continue;
				}

				// BIC (A4.1.6)
				if ((inst & 0x0de00000) === 0x01c00000 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					if (shifter) {
						if (ASM) lines.push(`bic${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rn]}, ${shifter}`);
						continue;
					}
				}

				// BKPT (A4.1.7)
				if ((inst & 0xfff000f0) === (0xe1200070 | 0)) {
					const immed = (((inst >>> 8) & 0xfff) << 4) | (inst & 0xf);
					if (ASM) lines.push(`bkpt ${imm(immed)}`);
					continue;
				}

				// BLX (A4.1.8 - A4.1.9)
				if ((inst & 0xfe000000) === (0xfa000000 | 0) && isArmv5) {
					// (1) (A4.1.8)
					const H = (inst >>> 24) & 1;
					const immed = inst & 0xffffff;
					if (ASM) lines.push(`blx ${imm((immed << 2) | (H << 1))}`);
					continue;
				} else if ((inst & 0x0ff000f0) === 0x01200030 && cond !== conds[0b1111] && isArmv5) {
					// (2) (A4.1.9) OK
					const Rm = inst & 0xf;
					const u = unpredictable((inst & 0x000fff00) !== 0x000fff00); // should-be-one
					if (ASM) lines.push(`blx${cond} ${r[Rm]}` + u);
					continue;
				}

				// BX (A4.1.10)
				if ((inst & 0x0ff000f0) === 0x01200010 && cond !== conds[0b1111]) {
					const Rm = inst & 0xf;
					const u = unpredictable((inst & 0x000fff00) !== 0x000fff00); // should-be-one
					if (ASM) lines.push(`<span style="color:var(--green);">bx${cond}</span> ${r[Rm]}` + u);
					continue;
				}

				// CDP (A4.1.12)
				if ((inst & 0x0f000010) === 0x0e000000) {
					const opcode1 = (inst >>> 20) & 0xf;
					const CRn = (inst >>> 16) & 0xf;
					const CRd = (inst >>> 12) & 0xf;
					const cpNum = (inst >>> 8) & 0xf;
					const opcode2 = (inst >>> 5) & 7;
					const CRm = inst & 0xf;
					if (cond === conds[0b1111]) {
						// CDP2 is only available on armv5
						if (isArmv5) {
							if (ASM)
								lines.push(
									`cdp2 p${cpNum}, ${imm(opcode1)}, c${CRd}, c${CRn}, c${CRm}, ${imm(opcode2)}`,
								);
							continue;
						}
					} else {
						if (ASM)
							lines.push(
								`cdp${cond} p${cpNum}, ${imm(opcode1)}, c${CRd}, c${CRn}, c${CRm}, ${imm(opcode2)}`,
							);
						continue;
					}
				}

				// CLZ (A4.1.13)
				if ((inst & 0x0ff000f0) === 0x01600010 && cond !== conds[0b1111] && isArmv5) {
					const Rd = (inst >>> 12) & 0xf;
					const Rm = inst & 0xf;
					// should-be-one
					const u = unpredictable((inst & 0x000f0f00) !== 0x000f0f00 || Rd === 15 || Rm === 15);
					if (ASM) lines.push(`clz${cond} ${r[Rd]}, ${r[Rm]}` + u);
					continue;
				}

				// CMN (A4.1.14)
				if ((inst & 0x0df00000) === 0x01700000 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf;
					const shifter = shifterOperand(inst);
					const u = unpredictable(inst & 0x0000f000); // should-be-zero
					if (shifter) {
						if (ASM) lines.push(`cmn${cond} ${r[Rn]}, ${shifter}` + u);
						continue;
					}
				}

				// CMP (A4.1.15)
				if ((inst & 0x0df00000) === 0x01500000 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf;
					const u = unpredictable(inst & 0x0000f000); // should-be-zero
					const shifter = shifterOperand(inst);
					if (shifter) {
						if (ASM) lines.push(`cmp${cond} ${r[Rn]}, ${shifter}` + u);
						continue;
					}
				}

				// EOR (A4.1.18)
				if ((inst & 0x0de00000) === 0x00200000 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					if (shifter) {
						if (ASM) lines.push(`eor${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rn]}, ${shifter}`);
						continue;
					}
				}

				// LDC (A4.1.19)
				if ((inst & 0x0e100000) === 0x0c100000) {
					const N = (inst >>> 22) & 1;
					const CRd = (inst >>> 12) & 0xf;
					const cpNum = (inst >>> 8) & 0xf;
					const addressing = coprocessorAddressingMode(inst);
					if (cond === conds[0b1111]) {
						// LDC2 is only available on armv5
						if (isArmv5) {
							if (ASM) lines.push(`ldc2${N ? 'l' : ''} p${cpNum}, c${CRd}, ${addressing}`);
							continue;
						}
					} else {
						if (ASM) lines.push(`ldc${cond}${N ? 'l' : ''} p${cpNum}, c${CRd}, ${addressing}`);
						continue;
					}
				}

				// LDM (A4.1.20 - A4.1.22)
				if ((inst & 0x0e500000) === 0x08100000 && cond !== conds[0b1111]) {
					// (1) (A4.1.20)
					const W = (inst >>> 21) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const registers = inst & 0xffff;
					const addressing = loadMultipleAddressingMode(inst);
					const u = unpredictable(!registers || Rn === 15 || (W && registers & (1 << Rn)));

					if (addressing) {
						if (ASM) {
							const list = [];
							for (let bit = 1, i = 0; i < 16; bit <<= 1, ++i) {
								if (registers & bit) list.push(r[i]);
							}
							lines.push(
								`<span style="color:var(--green);">ldm${cond}${addressing}</span> ${r[Rn]}${W ? '!' : ''}, {${list.join(', ')}}` +
									u,
							);
						}
						continue;
					}
				} else if ((inst & 0x0e708000) === 0x08500000 && cond !== conds[0b1111]) {
					// (2) (A4.1.21)
					const Rn = (inst >>> 16) & 0xf;
					const registers = inst & 0x7fff;
					const addressing = loadMultipleAddressingMode(inst);
					const u = unpredictable(!registers || Rn === 15);

					if (addressing) {
						if (ASM) {
							const list = [];
							for (let bit = 1, i = 0; i < 15; bit <<= 1, ++i) {
								if (registers & bit) list.push(r[i]);
							}

							lines.push(
								`<span style="color:var(--green);">ldm${cond}${addressing}</span> ${r[Rn]}, {${list.join(', ')}}^` +
									u,
							);
						}
						continue;
					}
				} else if ((inst & 0x0e508000) === 0x08508000 && cond !== conds[0b1111]) {
					// (3) (A4.1.22)
					const W = (inst >>> 21) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const registers = inst & 0x7fff;
					const addressing = loadMultipleAddressingMode(inst);
					const u = unpredictable(Rn === 15 || (W && registers & (1 << Rn)));

					if (ASM) {
						const list = [];
						for (let bit = 1, i = 0; i < 15; bit <<= 1, ++i) {
							if (registers & bit) list.push(r[i]);
						}
						list.push(r[15]);

						lines.push(
							`<span style="color:var(--green);">ldm${cond}${addressing}</span> ${r[Rn]}${W ? '!' : ''}, {${list.join(', ')}}^` +
								u,
						);
					}
					continue;
				}

				// LDR (A4.1.23)
				if ((inst & 0x0c500000) === 0x04100000 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadAddressingMode(inst);
					// TODO: unpredictable if Rd == Rn on certain modes
					if (addressing) {
						if (ASM) lines.push(`ldr${cond} ${r[Rd]}, ${addressing}`);
						continue;
					}
				}

				// LDRB (A4.1.24)
				if ((inst & 0x0c500000) === 0x04500000 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadAddressingMode(inst);
					const u = unpredictable(Rd === 15);
					// TODO: unpredictable if Rd == Rn on certain modes
					if (addressing) {
						if (ASM) lines.push(`ldr${cond}b ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// LDRBT (A4.1.25)
				if ((inst & 0x0c700000) === 0x04700000 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadAddressingMode(inst);
					const u = unpredictable(Rd === 15);
					// TODO: unpredictable if Rd == Rn on certain modes
					if (addressing) {
						if (ASM) lines.push(`ldr${cond}bt ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// LDRD (A4.1.26)
				if ((inst & 0x0e5000f0) === 0x004000d0 && isArmv5 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadMiscAddressingMode(inst);
					const u = unpredictable(Rd === 14);
					// TODO: unpredictable if Rd == Rn on certain modes
					if (addressing && Rd % 2 === 0) {
						// instruction is undefined if Rd is odd
						if (ASM) lines.push(`ldr${cond}d ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// LDRH (A4.1.28)
				if ((inst & 0x0e5000f0) === 0x005000b0 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadMiscAddressingMode(inst);
					const u = unpredictable(Rd === 15);
					// TODO: unpredictable if Rd == Rn on certain modes
					if (addressing) {
						if (ASM) lines.push(`ldr${cond}h ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// LDRSB (A4.1.29)
				if ((inst & 0x0e5000f0) === 0x005000d0 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadMiscAddressingMode(inst);
					const u = unpredictable(Rd === 15);
					// TODO: unpredictable if Rd == Rn on certain modes
					if (addressing) {
						if (ASM) lines.push(`ldr${cond}sb ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// LDRSH (A4.1.30)
				if ((inst & 0x0e5000f0) === 0x005000f0 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadMiscAddressingMode(inst);
					const u = unpredictable(Rd === 15);
					// TODO: unpredictable if Rd == Rn on certain modes
					if (addressing) {
						if (ASM) lines.push(`ldr${cond}sh ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// LDRT (A4.1.31)
				if ((inst & 0x0d700000) === 0x04300000 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf; // used for testing unpredictability
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadAddressingMode(inst);
					const u = unpredictable(Rd === 15 || Rd === Rn);
					if (addressing) {
						if (ASM) lines.push(`ldr${cond}t ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// MCR (A4.1.32)
				if ((inst & 0x0f100010) === 0x0e000010) {
					const opcode1 = (inst >>> 21) & 7;
					const CRn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const cpNum = (inst >>> 8) & 0xf;
					const opcode2 = (inst >>> 5) & 7;
					const CRm = inst & 0xf;
					const u = unpredictable(Rd === 15);
					if (cond === conds[0b1111]) {
						// MCR2 is only available on ARMv5
						if (isArmv5) {
							if (ASM)
								lines.push(
									`mcr2 p${cpNum}, ${opcode1}, ${r[Rd]}, c${CRn}, c${CRm}` +
										(opcode2 ? `, ${opcode2}` : '') +
										u,
								);
							continue;
						}
					} else {
						if (ASM)
							lines.push(
								`mcr${cond} p${cpNum}, ${opcode1}, ${r[Rd]}, c${CRn}, c${CRm}` +
									(opcode2 ? `, ${opcode2}` : '') +
									u,
							);
						continue;
					}
				}

				// MCRR (A4.1.33)
				if ((inst & 0x0ff00000) === 0x0c400000 && isArmv5 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const cpNum = (inst >>> 8) & 0xf;
					const opcode = (inst >>> 4) & 0xf;
					const CRm = inst & 0xf;
					const u = unpredictable(Rn === 15 || Rd === 15 || Rn === Rd);
					if (ASM) lines.push(`mcrr${cond} p${cpNum}, ${opcode}, ${r[Rd]}, ${r[Rn]}, c${CRm}` + u);
					continue;
				}

				// MLA (A4.1.34)
				if ((inst & 0x0fe000f0) === 0x00200090 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rd = (inst >>> 16) & 0xf;
					const Rn = (inst >>> 12) & 0xf;
					const Rs = (inst >>> 8) & 0xf;
					const Rm = inst & 0xf;
					const u = unpredictable(Rd === 15 || Rn === 15 || Rs === 15 || Rm === 15 || Rd === Rm);
					if (ASM) lines.push(`mla${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rm]}, ${r[Rs]}, ${r[Rn]}` + u);
					continue;
				}

				// MOV (A4.1.35)
				if ((inst & 0x0de00000) === 0x01a00000 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					const u = unpredictable((inst >>> 16) & 0xf); // should-be-zero
					if (shifter) {
						if (ASM) lines.push(`mov${cond}${S ? 's' : ''} ${r[Rd]}, ${shifter}` + u);
						continue;
					}
				}

				// MRC (A4.1.36)
				if ((inst & 0x0f100010) === 0x0e100010) {
					const opcode1 = (inst >>> 21) & 7;
					const CRn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const cpNum = (inst >>> 8) & 0xf;
					const opcode2 = (inst >>> 5) & 7;
					const CRm = inst & 0xf;
					if (cond === conds[0b1111]) {
						// MCR2 is only available on ARMv5
						if (isArmv5) {
							if (ASM)
								lines.push(
									`mrc2 p${cpNum}, ${opcode1}, ${r[Rd]}, c${CRn}, c${CRm}` +
										(opcode2 ? `, ${opcode2}` : ''),
								);
							continue;
						}
					} else {
						if (ASM)
							lines.push(
								`mrc${cond} p${cpNum}, ${opcode1}, ${r[Rd]}, c${CRn}, c${CRm}` +
									(opcode2 ? `, ${opcode2}` : ''),
							);
						continue;
					}
				}

				// MRRC (A4.1.37)
				if ((inst & 0x0ff00000) === 0x0c500000 && isArmv5 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const cpNum = (inst >>> 8) & 0xf;
					const opcode = (inst >>> 4) & 0xf;
					const CRm = inst & 0xf;
					const u = unpredictable(Rd === 15 || Rn === 15 || Rd === Rn);
					if (ASM) lines.push(`mrrc${cond} p${cpNum}, ${opcode}, ${r[Rd]}, ${r[Rn]}, c${CRm}`);
					continue;
				}

				// MRS (A4.1.38)
				if ((inst & 0x0fb00000) === 0x01000000 && cond !== conds[0b1111]) {
					// TODO: unpredictable when accessing SPSR in User mode or System mode. should this be noted?
					const R = (inst >>> 22) & 1;
					const Rd = (inst >>> 12) & 0xf;
					// should-be-one or -zero
					const u = unpredictable(Rd === 15 || ((inst >>> 16) & 0xf) !== 0xf || inst & 0xfff);
					if (ASM) lines.push(`mrs${cond} ${r[Rd]}, ${R ? 'spsr' : 'cpsr'}` + u);
					continue;
				}

				// MSR (A4.1.39)
				if ((inst & 0x0fb00000) === 0x03200000 && cond !== conds[0b1111]) {
					// immediate operand
					const R = (inst >>> 22) & 1;
					const fieldMask = (inst >>> 16) & 0xf;
					const rotateImm = (inst >>> 8) & 0xf;
					const immed = inst & 0xff;
					// fieldMask = 0 behavior is not specifically 'unpredictable' or 'undefined', but it doesn't
					// fit with the syntax;;; should-be-one
					const u = unpredictable(!fieldMask || ((inst >>> 12) & 0xf) !== 0xf);
					if (ASM) {
						const rotated = (immed >> (rotateImm * 2)) | (immed << (32 - rotateImm * 2));
						const fields = [];
						if (fieldMask & 1) fields.push('c');
						if (fieldMask & 2) fields.push('x');
						if (fieldMask & 4) fields.push('s');
						if (fieldMask & 8) fields.push('f');
						lines.push(`msr${cond} ${R ? 'spsr' : 'cpsr'}_${fields.join('')}, #${imm(rotated)}` + u);
					}
					continue;
				} else if ((inst & 0x0fb000f0) === 0x01200000 && cond !== conds[0b1111]) {
					// register operand
					const R = (inst >>> 22) & 1;
					const fieldMask = (inst >>> 16) & 0xf;
					const Rm = inst & 0xf;
					// fieldMask === 0 behavior is not specifically 'unpredictable' or 'undefined', but it doesn't
					// fit with the syntax;;; should-be-one and -zero
					const u = unpredictable(!fieldMask || ((inst >>> 12) & 0xf) !== 0xf || (inst >>> 8) & 0xf);
					if (ASM) {
						const fields = [];
						if (fieldMask & 1) fields.push('c');
						if (fieldMask & 2) fields.push('x');
						if (fieldMask & 4) fields.push('s');
						if (fieldMask & 8) fields.push('f');
						lines.push(`msr${cond} ${R ? 'spsr' : 'cpsr'}_${fields.join('')}, ${r[Rm]}` + u);
					}
					continue;
				}

				// MUL (A4.1.40)
				if ((inst & 0x0fe000f0) === 0x00000090 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rd = (inst >>> 16) & 0xf;
					const Rs = (inst >>> 8) & 0xf;
					const Rm = inst & 0xf;
					// should-be-zero
					const u = unpredictable(Rd === 15 || Rm === 15 || Rs === 15 || Rd === Rs || (inst >>> 12) & 0xf);
					if (ASM) lines.push(`mul${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rm]}, ${r[Rs]}` + u);
					continue;
				}

				// MVN (A4.1.41)
				if ((inst & 0x0de00000) === 0x01e00000 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					const u = unpredictable((inst >>> 16) & 0xf); // should-be-zero
					if (shifter) {
						if (ASM) lines.push(`mvn${cond}${S ? 's' : ''} ${r[Rd]}, ${shifter}` + u);
						continue;
					}
				}

				// ORR (A4.1.42)
				if ((inst & 0x0de00000) === 0x01800000 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					if (shifter) {
						if (ASM) lines.push(`orr${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rn]}, ${shifter}`);
						continue;
					}
				}

				// PLD (A4.1.45)
				if ((inst & 0xfd70f000) === (0xf550f000 | 0) && isArmv5) {
					const addressing = loadAddressingMode(inst);
					if (ASM) lines.push(`pld ${addressing}`);
					continue;
				}

				// QADD (A4.1.46)
				if ((inst & 0x0ff000f0) === 0x01000050 && isArmv5 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const Rm = inst & 0xf;
					// should-be-zero
					const u = unpredictable((inst >>> 8) & 0xf || Rd === 15 || Rm === 15 || Rn === 15);
					if (ASM) lines.push(`qadd${cond} ${r[Rd]}, ${r[Rm]}, ${r[Rn]}` + u);
					continue;
				}

				// QDADD (A4.1.50)
				if ((inst & 0x0ff000f0) === 0x01400050 && isArmv5 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const Rm = inst & 0xf;
					// should-be-zero
					const u = unpredictable((inst >>> 8) & 0xf || Rd === 15 || Rm === 15 || Rn === 15);
					if (ASM) lines.push(`qdadd${cond} ${r[Rd]}, ${r[Rm]}, ${r[Rn]}` + u);
					continue;
				}

				// QDSUB (A4.1.51)
				if ((inst & 0x0ff000f0) === 0x01600050 && isArmv5 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const Rm = inst & 0xf;
					// should-be-zero
					const u = unpredictable((inst >>> 8) & 0xf || Rd === 15 || Rm === 15 || Rn === 15);
					if (ASM) lines.push(`qdsub${cond} ${r[Rd]}, ${r[Rm]}, ${r[Rn]}` + u);
					continue;
				}

				// QSUB (A4.1.52)
				if ((inst & 0x0ff000f0) === 0x01200050 && isArmv5 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const Rm = inst & 0xf;
					// should-be-zero
					const u = unpredictable((inst >>> 8) & 0xf || Rd === 15 || Rm === 15 || Rn === 15);
					if (ASM) lines.push(`qsub${cond} ${r[Rd]}, ${r[Rm]}, ${r[Rn]}` + u);
					continue;
				}

				// RSB (A4.1.60)
				if ((inst & 0x0de00000) === 0x00300000 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					if (shifter) {
						if (ASM) lines.push(`rsb${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rn]}, ${shifter}`);
						continue;
					}
				}

				// RSC (A4.1.61)
				if ((inst & 0x0de00000) === 0x00e00000 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					if (shifter) {
						if (ASM) lines.push(`rsc${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rn]}, ${shifter}`);
						continue;
					}
				}

				// SBC (A4.1.65)
				if ((inst & 0x0de00000) === 0x00c00000 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					if (shifter) {
						if (ASM) lines.push(`sbc${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rn]}, ${shifter}`);
						continue;
					}
				}

				// SMLA<x><y> (A4.1.74)
				if ((inst & 0x0ff00090) === 0x01000080 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 16) & 0xf;
					const Rn = (inst >>> 12) & 0xf;
					const Rs = (inst >>> 8) & 0xf;
					const y = (inst >>> 6) & 1;
					const x = (inst >>> 5) & 1;
					const Rm = inst & 0xf;
					const u = unpredictable(Rd === 15 || Rm === 15 || Rn === 15 || Rs === 15);
					if (ASM)
						lines.push(
							`smla${x ? 't' : 'b'}${y ? 't' : 'b'}${cond} ${r[Rd]}, ${r[Rm]}, ` +
								`${r[Rs]}, ${r[Rn]}` +
								u,
						);
					continue;
				}

				// SMLAL (A4.1.76)
				if ((inst & 0x0fe000f0) === 0x00e00090 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const RdHi = (inst >>> 16) & 0xf;
					const RdLo = (inst >>> 12) & 0xf;
					const Rs = (inst >>> 8) & 0xf;
					const Rm = inst & 0xf;
					const u = unpredictable(
						RdHi === 15 ||
							RdLo === 15 ||
							Rm === 15 ||
							Rs === 15 ||
							RdHi === RdLo ||
							RdHi === Rm ||
							RdLo === Rm,
					);
					if (ASM) lines.push(`smlal${cond}${S ? 's' : ''} ${r[RdLo]}, ${r[RdHi]}, ${r[Rm]}, ${r[Rs]}`);
					continue;
				}

				// SMLAL<x><y> (A4.1.77)
				if ((inst & 0x0ff00090) === 0x01400080 && isArmv5 && cond !== conds[0b1111]) {
					const RdHi = (inst >>> 16) & 0xf;
					const RdLo = (inst >>> 12) & 0xf;
					const Rs = (inst >>> 8) & 0xf;
					const y = (inst >>> 6) & 1;
					const x = (inst >>> 5) & 1;
					const Rm = inst & 0xf;
					const u = unpredictable(RdLo === 15 || RdHi === 15 || Rm === 15 || Rs === 15 || RdLo === RdHi);
					if (ASM)
						lines.push(
							`smlal${x ? 't' : 'b'}${y ? 't' : 'b'}${cond} ${r[RdLo]}, ${r[RdHi]}, ` +
								`${r[Rm]}, ${r[Rs]}` +
								u,
						);
					continue;
				}

				// SMLAW<y> (A4.1.79)
				if ((inst & 0x0ff000b0) === 0x01200080 && isArmv5 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 16) & 0xf;
					const Rn = (inst >>> 12) & 0xf;
					const Rs = (inst >>> 8) & 0xf;
					const y = (inst >>> 6) & 1;
					const Rm = inst & 0xf;
					const u = unpredictable(Rd === 15 || Rm === 15 || Rn === 15 || Rs === 15);
					if (ASM) lines.push(`smlaw${y ? 't' : 'b'}${cond} ${r[Rd]}, ${r[Rm]}, ${r[Rs]}, ${r[Rn]}` + u);
					continue;
				}

				// SMUL<x><y> (A4.1.86)
				if ((inst & 0x0ff00090) === 0x01600080 && isArmv5 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 16) & 0xf;
					const Rs = (inst >>> 8) & 0xf;
					const y = (inst >>> 6) & 1;
					const x = (inst >>> 5) & 1;
					const Rm = inst & 0xf;
					const u = unpredictable(Rd === 15 || Rm === 15 || Rs === 15);
					if (ASM) lines.push(`smul${x ? 't' : 'b'}${y ? 't' : 'b'}${cond} ${r[Rd]}, ${r[Rm]}, ${r[Rs]}` + u);
					continue;
				}

				// SMULL (A4.1.87)
				if ((inst & 0x0fe000f0) === 0x00c00090 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const RdHi = (inst >>> 16) & 0xf;
					const RdLo = (inst >>> 12) & 0xf;
					const Rs = (inst >>> 8) & 0xf;
					const Rm = inst & 0xf;
					const u = unpredictable(
						RdLo === 15 ||
							RdHi === 15 ||
							Rm === 15 ||
							Rs === 15 ||
							RdHi === RdLo ||
							RdHi === Rm ||
							RdLo === Rm,
					);
					if (ASM) lines.push(`smull${cond}${S ? 's' : ''} ${r[RdLo]}, ${r[RdHi]}, ${r[Rm]}, ${r[Rs]}` + u);
					continue;
				}

				// SMULW<y> (A4.1.88)
				if ((inst & 0x0ff000b0) === 0x012000a0 && isArmv5 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 16) & 0xf;
					const Rs = (inst >>> 8) & 0xf;
					const y = (inst >>> 6) & 1;
					const Rm = inst & 0xf;
					// should-be-zero
					const u = unpredictable((inst >>> 12) & 0xf || Rd === 15 || Rm === 15 || Rs === 15);
					if (ASM) lines.push(`smulw${y ? 't' : 'b'}${cond} ${r[Rd]}, ${r[Rm]}, ${r[Rs]}` + u);
					continue;
				}

				// STC (A4.1.96)
				if ((inst & 0x0e100000) === 0x0c000000) {
					const N = (inst >>> 22) & 1;
					const CRd = (inst >>> 12) & 0xf;
					const cpNum = (inst >>> 8) & 0xf;
					const addressing = coprocessorAddressingMode(inst);
					if (cond === conds[0b1111]) {
						// STC2 is only on ARMv5
						if (isArmv5) {
							if (ASM) lines.push(`stc2${N ? 'l' : ''} p${cpNum}, c${CRd}, ${addressing}`);
							continue;
						}
					} else {
						if (ASM) lines.push(`stc${cond}${N ? 'l' : ''} p${cpNum}, c${CRd}, ${addressing}`);
						continue;
					}
				}

				// STM (A4.1.97 - A4.1.98)
				if ((inst & 0x0e500000) === 0x08000000 && cond !== conds[0b1111]) {
					// (1) (A4.1.97)
					const W = (inst >>> 21) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const registers = inst & 0xffff;
					const addressing = loadMultipleAddressingMode(inst);
					const u = unpredictable(
						Rn === 15 || registers === 0 || (W && registers & (1 << Rn) && registers & ((1 << Rn) - 1)),
					);
					if (ASM) {
						const list = [];
						for (let bit = 1, i = 0; i < 16; bit <<= 1, ++i) {
							if (registers & bit) list.push(r[i]);
						}
						lines.push(
							`<span style="color:var(--green);">stm${cond}${addressing}</span> ${r[Rn]}${W ? '!' : ''}, {${list.join(', ')}}` +
								u,
						);
					}
					continue;
				} else if ((inst & 0x0e700000) === 0x08400000 && cond !== conds[0b1111]) {
					// (2) (A4.1.98)
					const Rn = (inst >>> 16) & 0xf;
					const registers = inst & 0xffff;
					const addressing = loadMultipleAddressingMode(inst);
					const u = unpredictable(Rn === 15 || registers === 0);
					if (ASM) {
						const list = [];
						for (let bit = 1, i = 0; i < 16; bit <<= 1, ++i) {
							if (registers & bit) list.push(r[i]);
						}
						lines.push(
							`<span style="color:var(--green);">stm${cond}${addressing}</span> ${r[Rn]}, {${list.join(', ')}}^` +
								u,
						);
					}
					continue;
				}

				// STR (A4.1.99)
				if ((inst & 0x0c500000) === 0x04000000 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadAddressingMode(inst);
					if (addressing) {
						if (ASM) lines.push(`str${cond} ${r[Rd]}, ${addressing}`);
						continue;
					}
				}

				// STRB (A4.1.100)
				if ((inst & 0x0c500000) === 0x04400000 && cond !== conds[0b1111]) {
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadAddressingMode(inst);
					const u = unpredictable(Rd === 15);
					if (addressing) {
						if (ASM) lines.push(`str${cond}b ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// STRBT (A4.1.101)
				if ((inst & 0x0d700000) === 0x04600000 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf; // only for detecting unpredictability
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadAddressingMode(inst);
					const u = unpredictable(Rd === 15 || Rd === Rn);
					// TODO: "These forms have P == 0 and W == 0, where P and W are bit[24] and bit[21] respectively. This instruction uses P == 0 and W == 1 instead, but the addressing mode is the same in all other respects."
					if (addressing) {
						if (ASM) lines.push(`str${cond}bt ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// STRD (A4.1.102)
				if ((inst & 0x0e1000f0) === 0x000000f0 && isArmv5 && cond !== conds[0b1111]) {
					// TODO: unpredictable if Rn === Rd on some addressing modes
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadMiscAddressingMode(inst);
					const u = unpredictable(Rd === 14);
					if (addressing && Rd % 2 === 0) {
						// instruction is undefined if Rd is odd
						if (ASM) lines.push(`str${cond}d ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// STRH (A4.1.104)
				if ((inst & 0x0e1000f0) === 0x000000b0 && cond !== conds[0b1111]) {
					// TODO: unpredictable if Rn === Rd on some addressing modes
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadMiscAddressingMode(inst);
					const u = unpredictable(Rd === 15);
					if (addressing) {
						if (ASM) lines.push(`str${cond}h ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// STRT (A4.1.105)
				if ((inst & 0x0d700000) === 0x04200000 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf; // only for detecting unpredictability
					const Rd = (inst >>> 12) & 0xf;
					const addressing = loadAddressingMode(inst);
					const u = unpredictable(Rd === Rn);
					if (addressing) {
						if (ASM) lines.push(`str${cond}t ${r[Rd]}, ${addressing}` + u);
						continue;
					}
				}

				// SUB (A4.1.106)
				if ((inst & 0x0de00000) === 0x00400000 && cond !== conds[0b1111]) {
					const S = (inst >>> 20) & 1;
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const shifter = shifterOperand(inst);
					if (shifter) {
						if (ASM) lines.push(`sub${cond}${S ? 's' : ''} ${r[Rd]}, ${r[Rn]}, ${shifter}`);
						continue;
					}
				}

				// SWI (A4.1.107)
				if ((inst & 0x0f000000) === 0x0f000000 && cond !== conds[0b1111]) {
					const immed = inst & 0xffffff;
					if (ASM) lines.push(`swi${cond} ${imm(immed)}`);
					continue;
				}

				// SWP (A4.1.108)
				if ((inst & 0x0ff000f0) === 0x01000090 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const Rm = inst & 0xf;
					const u = unpredictable(
						(inst >>> 8) & 0xf || Rd === 15 || Rm === 15 || Rn === 15 || Rn === Rd || Rn === Rm,
					); // should-be-zero
					if (ASM) lines.push(`swp${cond} ${r[Rd]}, ${r[Rm]}, [${r[Rn]}]` + u);
					continue;
				}

				// SWPB (A4.1.109)
				if ((inst & 0x0ff000f0) === 0x01400090 && cond !== conds[0b1111]) {
					const Rn = (inst >>> 16) & 0xf;
					const Rd = (inst >>> 12) & 0xf;
					const Rm = inst & 0xf;
					const u = unpredictable(
						(inst >>> 8) & 0xf || Rd === 15 || Rm === 15 || Rn === 15 || Rn === Rd || Rn === Rm,
					); // should-be-zero
					if (ASM) lines.push(`swp${cond}b ${r[Rd]}, ${r[Rm]}, [${r[Rn]}]` + u);
					continue;
				}

				// TEQ (A4.1.116)
				if ((inst & 0x0df00000) === 0x01300000) {
					const Rn = (inst >>> 16) & 0xf;
					const shifter = shifterOperand(inst);
					const u = unpredictable((inst >>> 12) & 0xf); // should-be-zero
					if (shifter) {
						if (ASM) lines.push(`teq${cond} ${r[Rn]}, ${shifter}` + u);
						continue;
					}
				}

				// TST (A4.1.117)
				if ((inst & 0x0df00000) === 0x01100000) {
					const Rn = (inst >>> 16) & 0xf;
					const shifter = shifterOperand(inst);
					const u = unpredictable((inst >>> 12) & 0xf); // should-be-zero
					if (shifter) {
						if (ASM) lines.push(`tst${cond} ${r[Rn]}, ${shifter}` + u);
						continue;
					}
				}

				// UMLAL (A4.1.128)
				if ((inst & 0x0fe000f0) === 0x00a00090) {
					const S = (inst >>> 20) & 1;
					const RdHi = (inst >>> 16) & 0xf;
					const RdLo = (inst >>> 12) & 0xf;
					const Rs = (inst >>> 8) & 0xf;
					const Rm = inst & 0xf;
					const u = unpredictable(
						RdHi === 15 ||
							RdLo === 15 ||
							Rm === 15 ||
							Rs === 15 ||
							RdHi === RdLo ||
							RdHi === Rm ||
							RdLo === Rm,
					);
					if (ASM) lines.push(`umlal${cond}${S ? 's' : ''} ${r[RdLo]}, ${r[RdHi]}, ${r[Rm]}, ${r[Rs]}` + u);
					continue;
				}

				// UMULL (A4.1.129)
				if ((inst & 0x0fe000f0) === 0x00800090) {
					const S = (inst >>> 20) & 1;
					const RdHi = (inst >>> 16) & 0xf;
					const RdLo = (inst >>> 12) & 0xf;
					const Rs = (inst >>> 8) & 0xf;
					const Rm = inst & 0xf;
					const u = unpredictable(
						RdHi === 15 ||
							RdLo === 15 ||
							Rm === 15 ||
							Rs === 15 ||
							RdHi === RdLo ||
							RdHi === Rm ||
							RdLo === Rm,
					);
					if (ASM) lines.push(`umull${cond}${S ? 's' : ''} ${r[RdLo]}, ${r[RdHi]}, ${r[Rm]}, ${r[Rs]}` + u);
					continue;
				}

				// undefined
				lines.push('---');
			}

			return lines;
		});

		/* `style` can be 'object', 'asm_color', or 'asm' */
		const disassembleThumb = (disassembler.thumb = (binary, style, isArmv5) => {
			const OBJECT = style === 'object';
			const ASM = style === 'asm';

			const u16 = bufToU16(binary);
			const lines = [];

			for (let i = 0; i < u16.length; ++i) {
				const inst = u16[i];

				// ADC (A7.1.2)
				if ((inst & 0xffc0) === 0x4140) {
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`adc r${Rd}, r${Rm}`);
					continue;
				}

				// ADD (A7.1.3 - A7.1.9)
				if ((inst & 0xfe00) === 0x1c00) {
					// (1) (A7.1.3)
					const immed = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (immed !== 0) {
						if (ASM) lines.push(`add r${Rd}, r${Rn}, #${imm(immed)}`);
						continue;
					}
				} else if ((inst & 0xf800) === 0x3000) {
					// (2) (A7.1.4)
					const Rd = (inst >> 8) & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`add r${Rd}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xfe00) === 0x1800) {
					// (3) (A7.1.5)
					const Rm = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`add r${Rd}, r${Rn}, r${Rm}`);
					continue;
				} else if ((inst & 0xff00) === 0x4400) {
					// (4) (A7.1.6)
					const H1 = (inst >> 7) & 1;
					const H2 = (inst >> 6) & 1;
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					const u = unpredictable(H1 === 0 && H2 === 0);
					if (ASM) lines.push(`add r${(H1 << 3) | Rd}, r${(H2 << 3) | Rm}` + u);
					continue;
				} else if ((inst & 0xf800) === 0xa000) {
					// (5) (A7.1.7)
					const Rd = (inst >> 8) & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`add r${Rd}, pc, #${imm(immed)} * 4`);
					continue;
				} else if ((inst & 0xf800) === 0xa800) {
					// (6) (A7.1.8)
					const Rd = (inst >> 8) & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`add r${Rd}, sp, #${imm(immed)} * 4`);
					continue;
				} else if ((inst & 0xff80) === 0xb000) {
					// (7) (A7.1.9)
					const immed = inst & 0x7f;
					if (ASM) lines.push(`add sp, #${imm(immed)} * 4`);
					continue;
				}

				// AND (A7.1.10)
				if ((inst & 0xffc0) === 0x4000) {
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`and r${Rd}, r${Rm}`);
					continue;
				}

				// ASR (A7.1.11 - A7.1.12)
				if ((inst & 0xf800) === 0x1000) {
					// (1) (A7.1.11)
					const immed = (inst >> 6) & 0x1f;
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`asr r${Rd}, r${Rm}, #${imm(immed || 32)}`);
					continue;
				} else if ((inst & 0xffc0) === 0x4100) {
					// (2) (A7.1.12)
					const Rs = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`asr r${Rd}, r${Rs}`);
					continue;
				}

				// B (A7.1.13 - A7.1.14)
				if ((inst & 0xf000) === 0xd000) {
					// (1) (A7.1.13)
					const cond = (inst >> 8) & 0xf;
					const immed = (inst & 0xff) - (inst & 0x80) * 2; // signed
					if (cond === 0b1110);
					else if (cond !== 0b1111) {
						// undefined
						// 0b1111 is a SWI instruction
						if (ASM) lines.push(`b${conds[cond]} ${imm(immed * 2)}`);
						continue;
					}
				} else if ((inst & 0xf800) === 0xe000) {
					// (2) (A7.1.14)
					const immed = (inst & 0x7ff) - (inst & 0x400) * 2; // signed
					if (ASM) lines.push(`b ${imm(immed * 2)}`);
					continue;
				}

				// BIC (A7.1.15) OK
				if ((inst & 0xffc0) === 0x4380) {
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`bic r${Rd}, r${Rm}`);
					continue;
				}

				// BKPT (A7.1.16)
				if ((inst & 0xff00) === 0xbe00 && isArmv5) {
					const immed = inst & 0xff;
					if (ASM) lines.push(`bkpt ${imm(immed)}`);
					continue;
				}

				// BL, BLX (A7.1.17 - A7.1.18)
				if ((inst & 0xe000) === 0xe000) {
					// (1) (A7.1.17)
					const H = (inst >> 11) & 3;
					const offsetHigh = inst & 0x7ff;
					if (H === 2) {
						const next = u16[i + 1];
						if (next !== undefined && (next & 0xe000) === 0xe000) {
							const Hnext = (next >> 11) & 3;
							const offsetLow = next & 0x7ff;
							if (Hnext === 1 && isArmv5) {
								const u = unpredictable(offsetLow & 1);
								if (ASM) lines.push(`blx ${imm((offsetHigh << 12) | (offsetLow << 1))}` + u, '');
								++i;
								continue;
							} else if (Hnext === 3) {
								if (ASM) lines.push(`bl ${imm((offsetHigh << 12) | (offsetLow << 1))}`, '');
								++i;
								continue;
							}
						}

						if (ASM) lines.push(`bl?` + unpredictable(true));
						continue;
					} else if (H === 3) {
						if (ASM) lines.push(`bl` + unpredictable(true));
						continue;
					} else if (H === 1 && isArmv5) {
						if (ASM) lines.push(`blx` + unpredictable(true));
						continue;
					}
				} else if ((inst & 0xff80) === 0x4780 && isArmv5) {
					// (2) (A7.1.18)
					const H2 = (inst >> 6) & 1;
					const Rm = (inst >> 3) & 7;
					const u = unpredictable(inst & 7);
					if (ASM) lines.push(`blx r${(H2 << 3) | Rm}` + u);
					continue;
				}

				// BX (A7.1.19)
				if ((inst & 0xff80) === 0x4700) {
					const H2 = (inst >> 6) & 1;
					const Rm = (inst >> 3) & 7;
					const u = unpredictable(inst & 7);
					if (ASM) lines.push(`bx r${(H2 << 3) | Rm}` + u);
					continue;
				}

				// CMN (A7.1.20)
				if ((inst & 0xffc0) === 0x42c0) {
					const Rm = (inst >> 3) & 7;
					const Rn = inst & 7;
					if (ASM) lines.push(`cmn r${Rn}, r${Rm}`);
					continue;
				}

				// CMP (A7.1.21 - A7.1.23)
				if ((inst & 0xf800) === 0x2800) {
					// (1) (A7.1.21)
					const Rn = (inst >> 8) & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`cmp r${Rn}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xffc0) === 0x4280) {
					// (2) (A7.1.22)
					const Rm = (inst >> 3) & 7;
					const Rn = inst & 7;
					if (ASM) lines.push(`cmp r${Rn}, r${Rm}`);
					continue;
				} else if ((inst & 0xff00) === 0x4500) {
					// (3) (A7.1.23)
					const H1 = (inst >> 7) & 1;
					const H2 = (inst >> 6) & 1;
					const Rm = (inst >> 3) & 7;
					const Rn = inst & 7;
					const u = unpredictable(((H1 << 3) | Rn) === 0xf || (H1 === 0 && H2 === 0));
					if (ASM) lines.push(`cmp r${(H1 << 3) | Rn}, r${(H2 << 3) | Rm}` + u);
					continue;
				}

				// EOR (A7.1.26) OK
				if ((inst & 0xffc0) === 0x4040) {
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`eor r${Rd}, r${Rm}`);
					continue;
				}

				// LDMIA (A7.1.27) OK
				if ((inst & 0xf800) === 0xc800) {
					const Rn = (inst >> 8) & 7;
					const registers = inst & 0xff;
					const u = unpredictable(registers === 0);
					if (ASM) {
						const list = [];
						for (let bit = 1, i = 0; i < 8; bit <<= 1, ++i) {
							if (registers & bit) list.push(`r${i}`);
						}
						lines.push(`ldmia r${Rn}!, {${list.join(', ')}}` + u);
					}
					continue;
				}

				// LDR (A7.1.28 - A7.1.31)
				if ((inst & 0xf800) === 0x6800) {
					// (1) (A7.1.28)
					const immed = (inst >> 6) & 0x1f;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldr r${Rd}, [r${Rn}, #${imm(immed)} * 4]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5800) {
					// (2) (A7.1.29)
					const Rm = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldr r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				} else if ((inst & 0xf800) === 0x4800) {
					// (3) (A7.1.30)
					const Rd = (inst >> 8) & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`ldr r${Rd}, [pc, #${imm(immed)} * 4]`);
					continue;
				} else if ((inst & 0xf800) === 0x9800) {
					// (4) (A7.1.31)
					const Rd = (inst >> 8) & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`ldr r${Rd}, [sp, #${imm(immed)} * 4]`);
					continue;
				}

				// LDRB (A7.1.32 - A7.1.33)
				if ((inst & 0xf800) === 0x7800) {
					// (1) (A7.1.32)
					const immed = (inst >> 6) & 0x1f;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrb r${Rd}, [r${Rn}, #${imm(immed)}]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5c00) {
					// (2) (A7.1.33)
					const Rm = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrb r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// LDRH (A7.1.34 - A7.1.35)
				if ((inst & 0xf800) === 0x8800) {
					// (1) (A7.1.34)
					const immed = (inst >> 6) & 0x1f;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrh r${Rd}, [r${Rn}, #${imm(immed)} * 2]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5a00) {
					// (2) (A7.1.35)
					const Rm = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrh r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// LDRSB (A7.1.36) OK
				if ((inst & 0xfe00) === 0x5600) {
					const Rm = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrsb r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// LDRSH (A7.1.37) OK
				if ((inst & 0xfe00) === 0x5e00) {
					const Rm = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrsh r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// LSL (A7.1.38 - A7.1.39)
				if ((inst & 0xf800) === 0) {
					// (1) (A7.1.38)
					const immed = (inst >> 6) & 0x1f;
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`lsl r${Rd}, r${Rm}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xffc0) === 0x4080) {
					// (2) (A7.1.39)
					const Rs = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`lsl r${Rd}, r${Rs}`);
					continue;
				}

				// LSR (A7.1.40 - A7.1.41)
				if ((inst & 0xf800) === 0x0800) {
					// (1) (A7.1.40)
					const immed = (inst >> 6) & 0x1f;
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`lsr r${Rd}, r${Rm}, #${imm(immed || 32)}`);
					continue;
				} else if ((inst & 0xffc0) === 0x40c0) {
					// (2) (A7.1.41)
					const Rs = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`lsr r${Rd}, r${Rs}`);
					continue;
				}

				// MOV (A7.1.42 - A7.1.44)
				if ((inst & 0xf800) === 0x2000) {
					// (1) (A7.1.42)
					const Rd = (inst >> 8) & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`mov r${Rd}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xffc0) === 0x1c00) {
					// (2) (A7.1.43)
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`mov r${Rd}, r${Rn}`);
					continue;
				} else if ((inst & 0xff00) === 0x4600) {
					// (3) (A7.1.44)
					const H1 = (inst >> 7) & 1;
					const H2 = (inst >> 6) & 1;
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					const u = unpredictable(H1 === 0 && H2 === 0);
					if (ASM) lines.push(`mov r${(H1 << 3) | Rd}, r${(H2 << 3) | Rm}` + u);
					continue;
				}

				// MUL (A7.1.45)
				if ((inst & 0xffc0) === 0x4340) {
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					const u = unpredictable(Rm === Rd);
					if (ASM) lines.push(`mul r${Rd}, r${Rm}` + u);
					continue;
				}

				// MVN (A7.1.46)
				if ((inst & 0xffc0) === 0x43c0) {
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`mvn r${Rd}, r${Rm}`);
					continue;
				}

				// NEG (A7.1.47)
				if ((inst & 0xffc0) === 0x4240) {
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`neg r${Rd}, r${Rm}`);
					continue;
				}

				// ORR (A7.1.48)
				if ((inst & 0xffc0) === 0x4300) {
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`orr r${Rd}, r${Rm}`);
					continue;
				}

				// POP (A7.1.49)
				if ((inst & 0xfe00) === 0xbc00) {
					const R = (inst >> 8) & 1;
					const registers = inst & 0xff;
					const u = unpredictable(R === 0 && registers === 0);
					if (ASM) {
						const list = [];
						for (let bit = 1, i = 0; i < 8; bit <<= 1, ++i) {
							if (registers & bit) list.push(`r${i}`);
						}
						lines.push(`pop {${list.join(', ')}}` + u);
					}
					continue;
				}

				// PUSH (A7.1.50)
				if ((inst & 0xfe00) === 0xb400) {
					const R = (inst >> 8) & 1;
					const registers = inst & 0xff;
					const u = unpredictable(R === 0 && registers === 0);
					if (ASM) {
						const list = [];
						for (let bit = 1, i = 0; i < 8; bit <<= 1, ++i) {
							if (registers & bit) list.push(`r${i}`);
						}
						lines.push(`push {${list.join(', ')}}` + u);
					}
					continue;
				}

				// ROR (A7.1.54)
				if ((inst & 0xffc0) === 0x41c0) {
					const Rs = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ror r${Rd}, r${Rs}`);
					continue;
				}

				// SBC (A7.1.55)
				if ((inst & 0xffc0) === 0x4180) {
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`sbc r${Rd}, r${Rm}`);
					continue;
				}

				// STMIA (A7.1.57)
				if ((inst & 0xf800) === 0xc000) {
					const Rn = (inst >> 8) & 7;
					const registers = inst & 0xff;
					const u = unpredictable(registers === 0 || ((1 << Rn) - 1) & registers);
					if (ASM) {
						const list = [];
						for (let bit = 1, i = 0; i < 8; bit <<= 1, ++i) {
							if (registers & bit) list.push(`r${i}`);
						}
						lines.push(`stmia r${Rn}!, {${list.join(', ')}}` + u);
					}
					continue;
				}

				// STR (A7.1.58 - A7.1.60)
				if ((inst & 0xf800) === 0x6000) {
					// (1) (A7.1.58)
					const immed = (inst >> 6) & 0x1f;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`str r${Rd}, [r${Rn}, #${imm(immed)} * 4]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5000) {
					// (2) (A7.1.59)
					const Rm = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`str r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				} else if ((inst & 0xf800) === 0x9000) {
					// (3) (A7.1.60)
					const Rd = (inst >> 8) & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`str r${Rd}, [sp, #${imm(immed)} * 4]`);
					continue;
				}

				// STRB (A7.1.61 - A7.1.62)
				if ((inst & 0xf800) === 0x7000) {
					// (1) (A7.1.61)
					const immed = (inst >> 6) & 0x1f;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`strb r${Rd}, [r${Rn}, #${imm(immed)}]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5400) {
					// (2) (A7.1.62)
					const Rm = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`strb r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// STRH (A7.1.63 - A7.1.64)
				if ((inst & 0xf800) === 0x8000) {
					// (1) (A7.1.63)
					const immed = (inst >> 6) & 0x1f;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`strh r${Rd}, [r${Rn}, #${imm(immed)} * 2]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5200) {
					// (2) (A7.1.64)
					const Rm = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`strh r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// SUB (A7.1.65 - A7.1.68)
				if ((inst & 0xfe00) === 0x1e00) {
					// (1) (A7.1.65)
					const immed = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`sub r${Rd}, r${Rn}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xf800) === 0x3800) {
					// (2) (A7.1.66)
					const immed = inst & 0xff;
					const Rd = (inst >> 8) & 7;
					if (ASM) lines.push(`sub r${Rd}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xfe00) === 0x1a00) {
					// (3) (A7.1.67)
					const Rm = (inst >> 6) & 7;
					const Rn = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`sub r${Rd}, r${Rn}, r${Rm}`);
					continue;
				} else if ((inst & 0xff80) === 0xb080) {
					// (4) (A7.1.68)
					const immed = inst & 0x7f;
					if (ASM) lines.push(`sub sp, #${imm(immed)} * 4`);
					continue;
				}

				// SWI (A7.1.69)
				if ((inst & 0xff00) === 0xdf00) {
					const immed = inst & 0xff;
					if (ASM) lines.push(`swi ${imm(immed)}`);
					continue;
				}

				// TST (A7.1.72)
				if ((inst & 0xffc0) === 0x4200) {
					const Rm = (inst >> 3) & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`tst r${Rd}, r${Rm}`);
					continue;
				}

				// undefined
				if (ASM) lines.push(`---`);
			}

			return lines;
		});

		const update = () => {
			display.innerHTML = '';
			if (select.value === 0) return;
			let binary;
			if (select.value === 1) binary = fs.arm9;
			else if (select.value === 2) binary = fs.arm7;
			else binary = fs.overlay(select.value - 3);

			const instSize = setSelect.value === 2 || setSelect.value === 3 ? 2 : 4;

			const disassembleStart = performance.now();
			const instructions = [
				() => disassembleArm(binary, 'asm', true),
				() => disassembleArm(binary, 'asm', false),
				() => disassembleThumb(binary, 'asm', true),
				() => disassembleThumb(binary, 'asm', false),
			][setSelect.value]();
			const disassembleTime = performance.now() - disassembleStart;

			const stats = document.createElement('div');
			display.appendChild(stats);

			const renderStart = performance.now();
			addHTML(
				display,
				`<div style="white-space: pre;"><code>${instructions
					.map((x, i) => {
						const loc = str16(i * instSize);
						return `${loc.length === 4 ? '&nbsp;' + loc : loc} <span style="color: #666; padding: 0 32px;">${bytes(i * instSize, instSize, binary)}</span> ${x}`;
					})
					.join('\r\n')}</code></div>`,
			);

			requestAnimationFrame(() => {
				const renderTime = performance.now() - renderStart;
				stats.innerHTML = `Disassembled in ${(disassembleTime / 1000).toFixed(3)}s, rendered in ${(renderTime / 1000).toFixed(3)}s`;
			});
		};
		update();

		return disassembler;
	}));
};
