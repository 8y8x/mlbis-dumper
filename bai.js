'use strict';

window.initBai = () => {
	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Battle Scripts                                                                                       |
	// +---------------------------------------------------------------------------------------------------------------+

	const bai = (window.bai = createSection('Battle Scripts', section => {
		const bai = {};

		// preprocess commands
		bai.dialect = [];
		for (const block of fsext.baiCommands) {
			const argc = block.getUint8(0);
			const args = [];
			for (let i = 0; i < (argc & 0x7f); ++i) {
				const type = i & 1 ? block.getUint8(1 + (i >> 1)) >> 4 : block.getUint8(1 + (i >> 1)) & 0xf;
				args.push(type);
			}

			bai.dialect.push({ returns: !!(argc & 0x80), args });
		}

		const options = [
			['/BAI/BAI_atk_hk.dat', 0xd000, fsext.bai_atk_hk],
			// this file is not referenced in overlays, and has no IDs assigned to it
			['/BAI/BAI_atk_mt.dat', undefined, { segments: [fs.get('/BAI/BAI_atk_mt.dat')] }],
			['/BAI/BAI_atk_nh.dat', 0xa000, fsext.bai_atk_nh],
			['/BAI/BAI_atk_yy.dat', 0xc000, fsext.bai_atk_yy],
			['/BAI/BAI_item_ji.dat', 0x5000, fsext.bai_item_ji],
			['/BAI/BAI_mon_cf.dat', 0x7000, fsext.bai_mon_cf],
			['/BAI/BAI_mon_ji.dat', 0x4000, fsext.bai_mon_ji],
			['/BAI/BAI_mon_yo.dat', 0x2000, fsext.bai_mon_yo],
			['/BAI/BAI_scn_cf.dat', 0x6000, fsext.bai_scn_cf],
			['/BAI/BAI_scn_ji.dat', 0x3000, fsext.bai_scn_ji],
			['/BAI/BAI_scn_yo.dat', 0x1000, fsext.bai_scn_yo],
		];
		const fileSelect = dropdown(
			options.map(entry => `<code>${entry[1] ? str16(entry[1]) : '????'}</code> ${entry[0]}`),
			0,
			() => update(),
		);
		section.appendChild(fileSelect);

		const scriptSelectNames = options.map(entry => {
			if (!entry[2].segments?.length) return ['(?)'];
			return entry[2].segments.map((x, i) => `${i}. (len 0x${x.byteLength.toString(16)})`);
		});

		let updateScript;
		let scriptSelect = dropdown([''], 0, () => updateScript());
		section.appendChild(scriptSelect);

		const refScanButton = button('Scan for References', () => {
			bai.scan();
			refScanButton.remove();
			update();
		});
		section.appendChild(refScanButton);

		const preview = document.createElement('div');
		section.appendChild(preview);

		bai.parse = script => {
			const labels = {
				default: script.getUint16(0, true) + 2,
				
			};
		};

		/* bai.parse = script => {
			const headerU16 = bufToU16(script);
			const scriptU8 = bufToU8(script);

			const parsed = [];
			let o = 14;
			for (; o + 5 < script.byteLength; ) {
				if (script.getUint8(o + 1) >= 3) {
					// array
					const offsetLeft = o;

					while (scriptU8[o] === 0xff) ++o;
					const composite = script.getUint16(o, true);
					o += 2;
					if (composite >>> 12 !== 8) break;
					const type = (composite >> 8) & 0xf;
					if (type >= 8) break;
					const elements = composite & 0xff;
					o += [1, 2, 4, 1, 2, 4, 2, 4][type] * elements;

					while (scriptU8[o] === 0xff) ++o;

					parsed.push({ opcode: -1, args: [], offsetLeft, offsetRight: o });
					continue;
				}

				const opcode = script.getUint16(o, true);
				const variables = script.getUint32(o + 2, true);
				const command = bai.dialect[opcode];
				if (!command) break;
				const offsetLeft = o;

				o += 6;

				let returnTarget;
				if (command.returns) ((returnTarget = script.getUint16(o, true)), (o += 2));

				const args = [];
				for (let i = 0; i < command.args.length; ++i) {
					const type = command.args[i];
					if (variables & (1 << i)) (args.push({ type: 'var', x: script.getUint16(o, true) }), (o += 2));
					else if (type === 0) args.push({ type: 'u8', x: script.getUint8(o++) });
					else if (type === 1) (args.push({ type: 'u16', x: script.getUint16(o, true) }), (o += 2));
					else if (type === 2) (args.push({ type: 'u32', x: script.getUint32(o, true) }), (o += 4));
					else if (type === 3) args.push({ type: 's8', x: script.getInt8(o++) });
					else if (type === 4) (args.push({ type: 's16', x: script.getInt16(o, true) }), (o += 2));
					else if (type === 5) (args.push({ type: 's32', x: script.getInt32(o, true) }), (o += 4));
					else if (type === 6) (args.push({ type: 'fp88', x: script.getInt16(o, true) / 256 }), (o += 2));
					else if (type === 7) (args.push({ type: 'fp2012', x: script.getInt32(o, true) / 4096 }), (o += 4));
				}

				parsed.push({ opcode, returnTarget, args, offsetLeft, offsetRight: o });
			}

			if (o < script.byteLength)
				parsed.push({ opcode: -1, args: [], offsetLeft: o, offsetRight: script.byteLength });

			return parsed;
		}; */

		bai.scan = () => {
			// #1 : discover the monsters using any particular script
			const scriptToMonsterIds = new Map();
			for (let i = 0; i < monsters.monsters.length; ++i) {
				const { script } = monsters.monsters[i];
				const list = scriptToMonsterIds.get(script);
				if (list) list.push(i);
				else scriptToMonsterIds.set(script, [i]);
			}

			// #2 : scan all scripts for BA_0066 (load attack script) and BA_0065 (create description from monster id)
			const attackToInvokerReferences = new Map();
			const monsterToCreatorReferences = new Map();
			const creatorToMonsterReferences = new Map();
			for (const [path, scriptSpace, { segments }] of options) {
				if (scriptSpace === undefined) continue; // BAI_atk_mt cannot be loaded, anyway

				let type;
				if (path.includes('_atk_')) type = 'atk';
				else if (path.includes('_mon_')) type = 'mon';
				else if (path.includes('_scn_')) type = 'scn';

				for (let i = 0; i < segments.length; ++i) {
					const script = scriptSpace + i;
					for (const cmd of bai.parse(segments[i])) {
						if (cmd.opcode === 0x66) {
							// load attack script
							if (cmd.args[0].type === 'var') continue;

							const atkScript = cmd.args[0].x;
							const ref = attackToInvokerReferences.get(atkScript);
							if (ref) ref[type].add(script);
							else
								attackToInvokerReferences.set(atkScript, {
									atk: new Set(),
									mon: new Set(),
									scn: new Set(),
									[type]: new Set([script]),
								});
						} else if (cmd.opcode === 0x65) {
							// create monster from description id
							if (cmd.args[1].type === 'var') continue;

							const monsterId = cmd.args[1].x;
							const ref = monsterToCreatorReferences.get(monsterId);
							if (ref) ref[type].add(script);
							else
								monsterToCreatorReferences.set(monsterId, {
									atk: new Set(),
									mon: new Set(),
									scn: new Set(),
									[type]: new Set([script]),
								});

							const ref2 = creatorToMonsterReferences.get(script);
							if (ref2) ref2.add(monsterId);
							else creatorToMonsterReferences.set(script, new Set([monsterId]));
						}
					}
				}
			}

			// #3 : compile dropdown names
			// only add a number to the end of a monster's name if there are duplicates
			const monsterNamesSeen = new Set();
			const monsterNamesSeenTwice = new Set();
			for (const { name } of monsters.monsters) {
				if (monsterNamesSeen.has(name)) monsterNamesSeenTwice.add(name);
				else monsterNamesSeen.add(name);
			}
			const monsterNames = [];
			for (let i = 0; i < monsters.monsters.length; ++i) {
				const { name } = monsters.monsters[i];
				if (monsterNamesSeenTwice.has(name)) monsterNames[i] = `${name}(${i})`;
				else monsterNames[i] = name;
			}
			const scriptSpaces = ['', 'yo', 'yo', 'ji', 'ji', 'ji', 'cf', 'cf', '', '', 'nh', 'yy', 'hk', '', ''];
			const scriptName = id => scriptSpaces[id >> 12] + `[${id & 0xfff}]`;

			for (let i = 0; i < options.length; ++i) {
				const [path, scriptSpace, { segments }] = options[i];
				if (scriptSpace === undefined) continue;

				let type;
				if (path.includes('_atk_')) type = 'atk';
				else if (path.includes('_mon_')) type = 'mon';
				else if (path.includes('_scn_')) type = 'scn';

				for (let j = 0; j < segments.length; ++j) {
					const script = scriptSpace + j;
					const receiverParts = [];
					let invokerPart = '';

					// mon scripts are also references by the monsters themselves
					const atk = new Set();
					const mon = new Set();
					const scn = new Set();
					if (type === 'mon') {
						const refs = scriptToMonsterIds.get(script);
						if (refs) {
							receiverParts.push(refs.map(id => monsterNames[id]).join(', '));
							for (const monsterId of refs) {
								const invokers = monsterToCreatorReferences.get(monsterId);
								if (invokers?.atk.size) {
									for (const otherScript of invokers.atk) atk.add(scriptName(otherScript));
								}
								if (invokers?.mon.size) {
									for (const otherScript of invokers.mon) {
										if (script !== otherScript) mon.add(scriptName(otherScript));
									}
								}
								if (invokers?.scn.size) {
									for (const otherScript of invokers.scn) scn.add(scriptName(otherScript));
								}
							}
						}
					}

					if (type === 'atk') {
						const refs = attackToInvokerReferences.get(script);
						if (refs?.mon.size) {
							for (const monScript of refs.mon) {
								const monsterIds = scriptToMonsterIds.get(monScript);
								if (monsterIds) {
									for (const id of monsterIds) mon.add(monsterNames[id]);
								}
							}
						}
						if (refs?.atk.size) {
							for (const otherScript of refs.atk) atk.add(scriptName(otherScript));
						}
						if (refs?.scn.size) {
							for (const otherScript of refs.scn) scn.add(scriptName(otherScript));
						}
					}

					if (atk.size) receiverParts.push('atk: ' + [...atk].join(', '));
					if (mon.size) receiverParts.push('mon: ' + [...mon].join(', '));
					if (scn.size) receiverParts.push('scn: ' + [...scn].join(', '));

					let refs = creatorToMonsterReferences.get(script);
					if (refs) invokerPart = `→ ${[...refs].map(id => monsterNames[id]).join('; ')}`;

					const parts = [`${j}. (len ${segments[j].byteLength}) `];
					if (receiverParts.length) parts.push('← ' + receiverParts.join('; '));
					if (receiverParts.length && invokerPart) parts.push('; ');
					if (invokerPart) parts.push(invokerPart);
					scriptSelectNames[i][j] = parts.join('');
				}
			}

			// ATK: 0. (1234 len) ← Durmite(45), Durmite X(46), Biffdus(47), scn: yo[14]
			// MON: 1. (2345 len) Durmite(45) ← scn: yo[13], yo[15], atk: cf[3]
			// SCN: 2. (2345 len) → Durmite(45)
		};

		// This is for debugging only. It can compile a BAI script from a textual format very similar to what is output,
		// except you denote locations with @name
		// and you can pass those to parameters, or label an instruction with one, then wherever that label is used
		// will be replaced with a relative offset to that instruction
		// Example:
		// @player_turn var[0x9000] = CM_0008(1)
		// var[0x1234] = BA_0123(var[0x4000], 0, 0x1000, @label) // this is a comment
		// BA_0001()
		bai.encode = (str, dat) => {
			const lines = str.trim().split('\n');
			const labelInjectLocations = new Map();
			const labelLocations = new Map();

			// first pass: compute instructions, and add to labels map
			dat.setUint16(0, 6, true);
			labelInjectLocations.set('@other_monster_turn', [[2, 2]]);
			dat.setUint16(2, 0, true);
			labelInjectLocations.set('@init', [[4, 4]]);
			dat.setUint16(4, 0, true);
			labelInjectLocations.set('@monster_turn', [[6, 6]]);
			dat.setUint16(6, 0, true);
			labelInjectLocations.set('@player_turn', [[8, 8]]);
			dat.setUint16(8, 0, true);
			labelInjectLocations.set('@unknown5', [[10, 10]]);
			dat.setUint16(10, 0, true);
			labelInjectLocations.set('@unknown6', [[12, 12]]);
			dat.setUint16(12, 0, true);
			let o = 14;
			for (let i = 0; i < lines.length; ++i) {
				const L = 'L' + String(i + 1) + ' ';
				const line = lines[i].trim();
				if (!line) continue;

				const components = line.match(
					/^(@[A-Za-z0-9_]+)?\s*(?:var\[0x([0-9A-Fa-f]{4})\]\s*\=\s*)?(?:BA|CM)_([A-Fa-f0-9]{4})\(([^\)]*)\)(?:\s*\/\/.*)?$/,
				);
				if (!components) throw `invalid line: ${line}`;

				const label = components[1];
				if (label) {
					if (labelLocations.has(label)) throw L + `Label ${label} already in use`;
					labelLocations.set(label, o);
				}

				const assignment = components[2];

				const opcode = parseInt(components[3], 16);
				const command = bai.dialect[opcode];
				if (!command) throw L + `Command 0x${str16(opcode)} not found`;
				if (assignment && !command.returns) throw L + `Command 0x${str16(opcode)} does not return a value`;
				if (!assignment && command.returns) throw L + `Command 0x${str16(opcode)} must accept a return value`;

				let varflags = 0;
				const rawArgs = components[4] === '' ? [] : components[4].split(', ');
				if (rawArgs.length !== command.args.length)
					throw L + `Command 0x${str16(opcode)} expects ${command.args.length} args, got ${rawArgs.length}`;

				dat.setUint16(o, opcode, true);
				o += 2;
				const varflagsOffset = o;
				o += 4;
				if (command.returns) {
					dat.setUint16(o, parseInt(assignment, 16), true);
					o += 2;
				}

				const labelInjectOffsetRightTodos = [];
				const write = (i, x) => {
					if (command.args[i] === 0) dat.setUint8(o++, x);
					else if (command.args[i] === 1) (dat.setUint16(o, x, true), (o += 2));
					else if (command.args[i] === 2) (dat.setUint32(o, x, true), (o += 4));
					else if (command.args[i] === 3) dat.setInt8(o++, x);
					else if (command.args[i] === 4) (dat.setInt16(o, x, true), (o += 2));
					else if (command.args[i] === 5) (dat.setInt32(o, x, true), (o += 4));
					else if (command.args[i] === 6) (dat.setInt16(o, x * 256, true), (o += 2));
					else if (command.args[i] === 7) (dat.setInt32(o, x * 4096, true), (o += 4));
				};
				for (let i = 0; i < rawArgs.length; ++i) {
					const x = rawArgs[i];
					const decimalMatch = x.match(/^\-?\d+(?:\.\d+)?$/);
					if (decimalMatch) {
						write(i, Number(x));
						continue;
					}

					const hexMatch = x.match(/^\-?0x([0-9A-Fa-f]+)$/);
					if (hexMatch) {
						write(i, parseInt(hexMatch[1], 16));
						continue;
					}

					const labelMatch = x.match(/^@[A-Za-z0-9_]+$/);
					if (labelMatch) {
						const list = labelInjectLocations.get(x);
						const pair = [o, 0];
						labelInjectOffsetRightTodos.push(pair);
						if (list) list.push(pair);
						else labelInjectLocations.set(x, [pair]);
						write(i, 0);
						continue;
					}

					const varMatch = x.match(/^var\[0x([0-9A-Fa-f]{4})\]$/);
					if (varMatch) {
						varflags |= 1 << i;
						dat.setUint16(o, parseInt(varMatch[1], 16), true);
						o += 2;
						continue;
					}

					throw L + `Invalid argument ${x}`;
				}

				dat.setUint32(varflagsOffset, varflags, true);
				for (const todo of labelInjectOffsetRightTodos) {
					todo[1] = o;
				}
			}

			// second pass: inject label locations
			for (const [label, locations] of labelInjectLocations) {
				const loc = labelLocations.get(label);
				if (!loc) {
					console.warn(`Label ${label} not assigned to any instruction, leaving as zero`);
					continue;
				}

				for (let i = 0; i < locations.length; ++i) {
					const [writeAt, base] = locations[i];
					dat.setInt16(writeAt, loc - base, true);
				}
			}

			return sliceDataView(dat, 0, o);
		};

		bai.actorAttributes = new Map([
			[3, 'x'],
			[4, 'y'],
			[5, 'z'],
			[9, 'home_x'],
			[10, 'home_y'],
			[11, 'home_z'],
			[24, 'animation'],
			[32, 'level'],
			[33, 'max_hp'],
			[34, 'hp'],
			[35, 'spd'], // why are you here
			[36, 'pow'],
			[37, 'def'],
			[47, 'invincible'],
			[63, 'sprite'],
		]);

		bai.monsterAttributes = new Map([
			[2, 'sprite'],
			[12, 'flying'],
		]);

		bai.spriteFile = x => {
			if (x >>> 24 === 0xc0) return `BObjPc[0x${(x & 0xffff).toString(16)}]`;
			if (x >>> 24 === 0xc1) return `BObjMon[0x${(x & 0xffff).toString(16)}]`;
			if (x >>> 24 === 0xc2) return `BObjUI[0x${(x & 0xffff).toString(16)}]`;
			return '(?)';
		};

		const operators = ['==', '!=', '<', '>', '<=', '>=', '&', '|', '^']; // unary operators are unused
		const builtin = x => `<span style="color: var(--peach);">${x}</span>`;
		const fn = x => `<span style="color: var(--blue);">${x}</span>`;
		const keyword = x => `<span style="color: var(--mauve);">${x}</span>`;
		const constant = x => `<span style="color: var(--peach);">${x}</span>`;
		const storage = x => `<span style="color: var(--yellow);">${x}</span>`;
		const operator = x => `<span style="color: var(--teal);">${x}</span>`;
		const text = x => `<span style="color: var(--text);">${x}</span>`;
		const location = x => `<span style="color: var(--sapphire);">${x}</span>`;
		const string = x => `<span style="color: var(--green);">${x}</span>`;
		bai.value = (x, context) => {
			if (context === 'actor') {
				if (x === 0x1000) return constant('MARIO');
				if (x === 0x1001) return constant('LUIGI');
				if (x === 0x1002) return constant('BOWSER');
				if (0x0000 <= x && x <= 0x0fff) return constant('UI_' + (x & 0xfff));
				if (0x2000 <= x && x <= 0x2fff) return constant('MONSTER_' + (x & 0xfff));
				if (0x3000 <= x && x <= 0x3fff) return constant('NPC_ATK_' + (x & 0xfff));
				if (0x4000 <= x && x <= 0x4fff) return constant('NPC_' + (x & 0xfff));
				if (0xa000 <= x && x <= 0xafff) return constant('DESC_ATK_' + (x & 0xfff));
				if (0xb000 <= x && x <= 0xbfff) return constant('DESCRIPTION_' + (x & 0xfff));
			}
			if (context === 'action_block')
				return constant([, 'JUMP', 'HAMMER', 'FLEE', 'ITEM', 'SPECIAL', 'PUNCH'][x] || x);
			if (context === 'coordinate') return constant(['X', 'Y', 'Z'][x] || x);
			if (context === 'party') {
				if (x === 2) return constant('MONSTERS');
				if (x === 513) return constant('PLAYERS');
			}
			if (context === 'positioning') return constant(['ABSOLUTE', 'RELATIVE'][x] || x);

			if (context === 'hex16') return constant('0x' + str16(x));
			if (context === 'hex32') return constant('0x' + str32(x));
			if (context === 'bool' && x === 0) return constant('false');
			if (context === 'bool' && x === 1) return constant('true');
			return constant(x);
		};
		bai.variable = (x, context) => {
			if (x === 0x4000) return storage('brg_self');
			if (x === 0x4002) return text('brg_target');
			if (x === 0x4008) return text('brg_buttons_held');
			if (x === 0x4009) return text('brg_buttons_pressed');
			if (x === 0x400a) return text('brg_buttons_released');
			if (x === 0x400b) return text('brg_buttons_released2');
			if (x === 0x400e) return text('brg_party_type');
			return text('var') + `[${constant('0x' + str16(x))}]`;
		};
		bai.command = (script, opcode, returnTarget, args, offsetLeft, offsetRight, functionLabels) => {
			const arg = (i, context) => {
				if (args[i].type === 'var') return bai.variable(args[i].x, context);
				else return bai.value(args[i].x, context);
			};
			const argsConcat = () => args.map((_, i) => arg(i)).join(', ');
			const pm = x => (x < 0 ? String(x) : '+' + x);

			const rp = returnTarget !== undefined ? `${bai.variable(returnTarget)} ${operator('=')} ` : '';

			switch (opcode) {
				case 1:
					return keyword('return');
				case 2: {
					const to = offsetRight + args[4].x;
					return `${keyword('if')} ${args[3].x ? '' : operator('!')}(${arg(1)} ${operator(operators[args[0].x])} ${arg(2)}) ${keyword('goto')} ${location(str16(to))} // (${pm(args[4].x)})`;
				}
				case 3: {
					const to = offsetRight + args[1].x;
					if (args[0].x === 1) return fn(functionLabels.get(to)) + '()';
					else return `${keyword('goto')} ${location(str16(to))} // (${pm(args[1].x)}) type ${args[0].x}`;
				}
				case 4:
					return builtin('wait') + `(${arg(0)})`;
				case 5:
					return builtin('stack_push') + `(${arg(0)})`;
				case 7: {
					const to = offsetRight + args[3].x;
					return `${keyword('if')} (${builtin('stack_compare')}(${arg(0)}, ${arg(1)}, ${arg(2)})) ${keyword('goto')} ${location(str16(to))} // (${pm(args[3].x)})`;
				}
				case 8:
					return rp + arg(0);
				case 9:
					return rp + arg(0) + operator(' + ') + arg(1);
				case 0xa:
					return rp + arg(0) + operator(' - ') + arg(1);
				case 0xb:
					return rp + arg(0) + operator(' * ') + arg(1);
				case 0xc:
					return rp + arg(0) + operator(' / ') + arg(1);
				case 0xd:
					return rp + arg(0) + operator(' % ') + arg(1);
				case 0xe:
					return rp + arg(0) + operator(' << ') + arg(1);
				case 0xf:
					return rp + arg(0) + operator(' >> ') + arg(1);
				case 0x10:
					return rp + arg(0) + operator(' & ') + arg(1);
				case 0x11:
					return rp + arg(0) + operator(' | ') + arg(1);
				case 0x12:
					return rp + arg(0) + operator(' ^ ') + arg(1);
				case 0x13:
					return rp + operator('-') + arg(0);
				case 0x14:
					return rp + builtin('bool') + `(${arg(0)})`;
				case 0x15:
					return rp + operator('~') + arg(0);
				case 0x16:
					return bai.variable(returnTarget) + operator('++');
				case 0x17:
					return bai.variable(returnTarget) + operator('--');
				case 0x18:
					return `${bai.variable(returnTarget)} ${operator('+=')} ${arg(0)}`;
				case 0x19:
					return `${bai.variable(returnTarget)} ${operator('-=')} ${arg(0)}`;
				case 0x1a:
					return `${bai.variable(returnTarget)} ${operator('*=')} ${arg(0)}`;
				case 0x1b:
					return `${bai.variable(returnTarget)} ${operator('/=')} ${arg(0)}`;
				case 0x1c:
					return `${bai.variable(returnTarget)} ${operator('%=')} ${arg(0)}`;
				case 0x1d:
					return `${bai.variable(returnTarget)} ${operator('<<=')} ${arg(0)}`;
				case 0x1e:
					return `${bai.variable(returnTarget)} ${operator('>>=')} ${arg(0)}`;
				case 0x1f:
					return `${bai.variable(returnTarget)} ${operator('&=')} ${arg(0)}`;
				case 0x20:
					return `${bai.variable(returnTarget)} ${operator('|=')} ${arg(0)}`;
				case 0x21:
					return `${bai.variable(returnTarget)} ${operator('^=')} ${arg(0)}`;
				case 0x22:
					return rp + builtin('sqrt') + `(${arg(0)})`;
				case 0x23:
					return rp + builtin('invsqrt') + `(${arg(0)})`;
				case 0x24:
					return rp + `${constant(1)} ${operator('/')} ${arg(0)}`;
				case 0x25:
					return rp + builtin('sin') + `(${arg(0)})`;
				case 0x26:
					return rp + builtin('cos') + `(${arg(0)})`;
				case 0x27:
					return rp + builtin('atan') + `(${arg(0)})`;
				case 0x28:
					return rp + builtin('atan2') + `(${arg(0)}, ${arg(1)})`;
				case 0x29:
					return rp + builtin('random') + `(${arg(0)})`;
				case 0x2a:
					return rp + `${arg(0)} [fx32]`;
				case 0x2b:
					return rp + `${arg(0)} ${operator('+')} ${arg(1)} [fx32]`;
				case 0x2c:
					return rp + `${arg(0)} ${operator('-')} ${arg(1)} [fx32]`;
				case 0x2d:
					return rp + `${arg(0)} ${operator('*')} ${arg(1)} [fx32]`;
				case 0x2e:
					return rp + `${arg(0)} ${operator('/')} ${arg(1)} [fx32]`;
				case 0x2f:
					return rp + `${arg(0)} ${operator('%')} ${arg(1)} [fx32]`;
				case 0x30:
					return rp + builtin('fx32_to_int') + `(${arg(0)})`;
				case 0x31:
					return rp + builtin('trunc') + `(${arg(0)}) [fx32]`;
				case 0x32:
					return rp + builtin('sqrt') + `(${arg(0)}) [fx32]`;
				case 0x33:
					return rp + builtin('invsqrt') + `(${arg(0)}) [fx32]`;
				case 0x34:
					return rp + `${constant(1)} ${operator('/')} ${arg(0)} [fx32]`;
				case 0x35:
					return rp + builtin('sin') + `(${arg(0)}) [fx32]`;
				case 0x36:
					return rp + builtin('cos') + `(${arg(0)}) [fx32]`;
				case 0x37:
					return rp + builtin('atan') + `(${arg(0)}) [fx32]`;
				case 0x38:
					return rp + builtin('atan2') + `(${arg(0)}, ${arg(1)}) [fx32]`;
				case 0x39: {
					const to = offsetRight + args[0].x;
					return rp + builtin('load_data_from_array') + `(${location(str16(to))}, ${arg(1)})`;
				}
				case 0x3a: {
					const to = offsetRight + args[0].x;
					return rp + builtin('load_data') + `(${location(str16(to))})`;
				}
				case 0x3b: {
					const to = offsetRight + args[0].x;
					return builtin('debugln') + `(${string('"' + shiftJis(script, to) + '"')})`;
				}
				case 0x3c: {
					const to = offsetRight + args[0].x;
					return builtin('debug') + `(${string('"' + shiftJis(script, to) + '"')})`;
				}
				case 0x3d:
					return builtin('debug_bin') + `(${arg(0)})`;
				case 0x3e:
					return builtin('debug_dec') + `(${arg(0)})`;
				case 0x3f:
					return builtin('debug_hex') + `(${arg(0)})`;
				case 0x41:
					return rp + builtin('add_coins') + `(${arg(0)})`;
				case 0x43:
					return rp + builtin('get_item_amount') + `(${arg(0)})`;
				case 0x44:
					return rp + builtin('add_items') + `(${arg(0)})`;
				case 0x45:
					return rp + builtin('get_player_stat') + `(${arg(0)}, ${arg(1)})`;
				case 0x46:
					return rp + builtin('set_player_stat') + `(${argsConcat()})`;
				// end CM_xxxx commands, begin BA_xxxx commands
				case 0x47: {
					const to = offsetRight + args[2].x;
					return rp + fn('call_then_bind') + `(${arg(0, 'actor')}, ${arg(1)}, ${fn(functionLabels.get(to))})`;
				}
				case 0x48: {
					const to = offsetRight + args[2].x;
					return rp + fn('bind_and_defer') + `(${arg(0, 'actor')}, ${arg(1)}, ${fn(functionLabels.get(to))})`;
				}
				case 0x49: {
					const to = offsetRight + args[2].x;
					return (
						rp + fn('spawn_actor_thread') + `(${arg(0, 'actor')}, ${arg(1)}, ${fn(functionLabels.get(to))})`
					);
				}
				case 0x4a:
					return rp + fn('join_actor_thread') + `(${arg(0, 'actor')})`;
				case 0x4e:
					return rp + fn('BA_004e') + `(${arg(0, 'actor')})`;
				case 0x58:
					return rp + fn('party_turn_check') + `(${arg(0, 'party')})`;
				case 0x59:
					return rp + fn('party_turn_wait') + `(${arg(0, 'party')}, ${arg(1)})`;
				case 0x63:
					return (
						rp +
						fn('desc_by_sprite_id') +
						`(${arg(0, 'actor')}, ${arg(1, 'hex32')}, ${arg(2)}) // ${bai.spriteFile(args[1].x)}`
					);
				case 0x65: {
					let comment;
					if (args[1].type !== 'var') comment = ' // ' + monsters.monsters[args[1].x]?.name ?? '(?)';
					else comment = ' // (?)';
					return rp + fn('desc_by_monster_id') + `(${arg(0, 'actor')}, ${arg(1)})` + comment;
				}
				case 0x66: {
					let scriptFile = '(?)';
					if (args[0].x >= 0xd000) scriptFile = 'BAI_atk_hk';
					else if (args[0].x >= 0xc000) scriptFile = 'BAI_atk_yy';
					else if (args[0].x >= 0xa000) scriptFile = 'BAI_atk_nh';
					return rp + fn('load_atk_script') + `(${arg(0, 'hex16')}) // ${scriptFile} ${args[0].x & 0xfff}`;
				}
				case 0x68:
					return rp + fn('desc_by_sprite_id_load') + `(${arg(0, 'actor')})`;
				case 0x69:
					return rp + fn('desc_by_monster_id_load') + `(${arg(0, 'actor')})`;
				case 0x6a:
					return rp + fn('load_atk_script2') + '()';
				case 0x6d:
					return rp + fn('npc_init') + `(${arg(0, 'actor')})`;
				case 0x6f:
					return rp + fn('monster_apply_desc') + `(${arg(0, 'actor')}, ${arg(1, 'actor')})`;
				case 0x71: {
					let bmapK = '(?)';
					let bmapML = '(?)';
					if (args[0].type !== 'var') {
						if (args[0].x === -1) bmapK = 'default';
						else bmapK = '0x' + str8(args[0].x / 8);
					}
					if (args[1].type !== 'var') {
						if (args[1].x === -1) bmapML = 'default';
						else bmapML = '0x' + str8(args[1].x / 8);
					}
					return (
						rp +
						fn('set_battle_background') +
						`(${arg(0)}, ${arg(1)}) // bowser bmap = ${bmapK}, m&l bmap = ${bmapML}`
					);
				}
				case 0x73: {
					const counterattack = constant(
						['NOTHING', 'JUMP', 'HAMMER', 'PUNCH', 'SHELL'][args[1].x] || args[1].x,
					);
					return rp + fn('player_set_counterattack') + `(${arg(0, 'actor')}, ${counterattack})`;
				}
				case 0x7b:
					return rp + fn('disable_action_block') + `(${arg(0, 'action_block')}, ${arg(1, 'bool')})`;
				case 0x7e:
					return rp + fn('end_battle') + `(${arg(0)}, ${arg(1)})`;
				case 0xad:
					return rp + fn('select_coordinate') + `(${arg(0)}, ${arg(1)}, ${arg(2)}, ${arg(3, 'coordinate')})`;
				case 0xbf: {
					let attribute = bai.actorAttributes.get(args[1].x);
					if (attribute) attribute = text('.' + attribute);
					else attribute = arg(1);

					return rp + fn('actor_attr_get') + `(${arg(0, 'actor')}, ${attribute})`;
				}
				case 0xc0: {
					let attribute = bai.actorAttributes.get(args[1].x);
					if (attribute) attribute = text('.' + attribute);
					else attribute = arg(1);

					let value;
					switch (args[1].x) {
						case 47:
							value = arg(2, 'bool');
							break; // .invincible
						case 63:
							value = arg(2, 'hex32');
							break; // sprite
						default:
							value = arg(2);
					}
					return rp + fn('actor_attr_set') + `(${arg(0, 'actor')}, ${attribute}, ${value})`;
				}
				case 0xc1: {
					let attribute = bai.actorAttributes.get(args[1].x);
					if (attribute) attribute = text('.' + attribute);
					else attribute = arg(1);

					return rp + fn('actor_attr_set_fx32') + `(${arg(0, 'actor')}, ${attribute}, ${arg(2)})`;
				}
				case 0xc6: {
					let attribute = bai.monsterAttributes.get(args[1].x);
					if (attribute) attribute = text('.' + attribute);
					else attribute = arg(1);

					return rp + fn('monster_get_attribute') + `(${arg(0, 'actor')}, ${attribute})`;
				}
				case 0xc8:
					return rp + fn('monster_kill') + `(${arg(0, 'actor')})`;
				case 0xc9:
					return rp + fn('actor_despawn') + `(${arg(0, 'actor')})`;
				case 0xd3:
					return rp + fn('npc_apply_desc') + `(${arg(0, 'actor')}, ${arg(1, 'actor')})`;
				case 0xe7:
					return (
						rp +
						fn('actor_move') +
						`(${arg(0, 'actor')}, ${arg(1)}, ${arg(2, 'positioning')}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ` +
						`speed=${arg(6)})`
					);
				case 0xe8:
					return (
						rp +
						fn('actor_move_fixed_duration') +
						`(${arg(0, 'actor')}, ${arg(1)}, ${arg(2, 'positioning')}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ` +
						`duration=${arg(6)})`
					);
				case 0xe9:
					return (
						rp +
						fn('actor_move_around_actor') +
						`(${arg(0, 'actor')}, ${arg(1)}, ${arg(2, 'actor')}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ` +
						`speed=${arg(6)})`
					);
				case 0xea:
					return (
						rp +
						fn('actor_move_around_actor_fixed_duration') +
						`(${arg(0, 'actor')}, ${arg(1)}, ${arg(2, 'actor')}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ` +
						`duration=${arg(6)})`
					);
				case 0xeb:
					return rp + fn('actor_move_wait') + `(${arg(0, 'actor')}, ${arg(1)})`;
				case 0xef:
					return (
						rp +
						fn('actor_set_position') +
						`(${arg(0, 'actor')}, ${arg(1, 'positioning')}, ${arg(2)}, ${arg(3)}, ${arg(4)})`
					);
				case 0xf0:
					return (
						rp +
						fn('actor_set_position_around_actor') +
						`(${arg(0, 'actor')}, ${arg(1, 'actor')}, ${arg(2)}, ${arg(3)}, ${arg(4)})`
					);
				case 0xf3:
					return (
						rp +
						fn('actor_set_home') +
						`(${arg(0, 'actor')}, ${arg(1, 'positioning')}, ${arg(2)}, ${arg(3)}, ${arg(4)})`
					);
				case 0x10f:
					return (
						rp +
						fn('actor_jump') +
						`(${arg(0, 'actor')}, ${arg(1)}, ${arg(2)}, height=${arg(3)}, speed=${arg(4)})`
					);
				case 0x121:
					return rp + fn('spawn_monster_atk_thread') + `(${arg(0, 'actor')}, ${arg(1, 'actor')})`;
				case 0x122:
					return rp + fn('join_monster_atk_thread') + `(${arg(0, 'actor')})`;
				case 0x124:
					return (
						rp +
						fn('monster_set_damage_victim') +
						`(${arg(0, 'actor')}, ${arg(1)}, ${arg(2, 'actor')}, ${arg(3)})`
					);
				case 0x125:
					return rp + fn('monster_set_damage_victims') + `(${arg(0, 'actor')}, ${arg(1)}, ${arg(2)})`;
				case 0x126:
					return rp + fn('monster_clear_damage_victims') + `(${arg(0, 'actor')})`;
				case 0x132:
					return (
						rp +
						fn('play_boss_death_animation') +
						`(${arg(0)}, ${arg(1, 'actor')}, ${arg(2, 'actor')}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ` +
						`${arg(6)})`
					);
				case 0x133:
					return rp + fn('play_boss_death_animation_0133') + `(${argsConcat()})`;
				case 0x134:
					return rp + fn('play_boss_death_animation_0134') + `(${argsConcat()})`;
				case 0x13b:
					return rp + fn('wait_for_boss_death_animation') + `(${argsConcat()})`;
				case 0x1ee: {
					let file = '(?)';
					if (args[0].x === 24) file = 'BMes_cf';
					else if (args[0].x === 23) file = 'BMes_ji';
					else if (args[0].x === 22) file = 'BMes_yo';
					return (
						rp +
						fn('load_messages') +
						`(${arg(0)}, ${arg(1)}) // ${file} table 0x${(args[1].x + 1).toString(16)}`
					);
				}
				case 0x1ef:
					return rp + fn('load_messages2') + '()';
				case 0x1f1:
					return rp + fn('textbox_say') + `(${argsConcat()})`;
				case 0x1f2:
					return rp + fn('textbox_wait') + `(${arg(0)})`;
				case 0x1fc:
					return (
						rp +
						fn('play_sound_directional') +
						`(${arg(0, 'actor')}, ${arg(1, 'hex32')}, ${arg(2)}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ` +
						`${arg(6)})`
					);
				case 0x1fd:
					return (
						rp +
						fn('play_sound_directional_handle') +
						`(${arg(0, 'actor')}, ${arg(1, 'hex32')}, ${arg(2)}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ` +
						`${arg(6)})`
					);
				case 0x1fe:
					return (
						rp +
						fn('play_sound') +
						`(${arg(0, 'actor')}, ${arg(1, 'hex32')}, ${arg(2)}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ` +
						`${arg(6)})`
					);
				case 0x1ff:
					return (
						rp +
						fn('play_sound_handle') +
						`(${arg(0, 'actor')}, ${arg(1, 'hex32')}, ${arg(2)}, ${arg(3)}, ${arg(4)}, ${arg(5)}, ` +
						`${arg(6)})`
					);
				case 0x200:
					return rp + fn('stop_sound') + `(${arg(0)})`;
				case 0x201:
					return rp + fn('set_music') + `(${arg(0)}) // ${sound.names[args[0].x] || '(?)'}`;
				case 0x202:
					return rp + fn('set_music2') + `(${arg(0)}) // ${sound.names[args[0].x] || '(?)'}`;
				case 0x203:
					return rp + fn('fade_out_music') + `(${arg(0)})`;
				case 0x204: {
					const to = offsetRight + args[5].x;
					return (
						`${keyword('if')} ${args[4].x ? '' : '!'}(` +
						`(${arg(1)} ${operator(operators[args[0].x])} ${arg(2)}) ${operator('==')} ${arg(3)}` +
						`) ${keyword('goto')} ${location(str16(to))} // (${pm(args[5].x)})`
					);
				}
				case 0x205: {
					const to = offsetRight + args[4].x;
					let key = bai.actorAttributes.get(args[2].x);
					if (key) key = text(key);
					else key = text('attr' + args[2].x);

					return (
						`${keyword('if')} (${arg(1, 'actor')}.${key} ${operator(operators[args[0].x])} ${arg(3)}) ` +
						`${keyword('goto')} ${location(str16(to))} // (${pm(args[4].x)})`
					);
				}
				case 0x206: {
					const to = offsetRight + args[2].x;
					return (
						rp +
						fn('BA_0206') +
						`(${arg(0, 'actor')}, ${arg(1)}, ${location(str16(to))}) // (${pm(args[2].x)})`
					);
				}
				case 0x207: {
					const to = offsetRight + args[3].x;
					return (
						rp +
						fn('BA_0207') +
						`(${arg(0, 'actor')}, ${arg(1)}, ${arg(2)}, ${location(str16(to))}) // (${pm(args[3].x)})`
					);
				}
				case 0x209: {
					const to = offsetRight + args[3].x;
					return (
						rp +
						fn('BA_0209') +
						`(${arg(0, 'actor')}, ${arg(1)}, ${arg(2)}, ${location(str16(to))}) // (${pm(args[3].x)})`
					);
				}
				case 0x213:
					return rp + fn('random_attack_target') + `(${arg(0)}, ${arg(1)})`;
				case 0x216:
					return rp + fn('actor_is_monster') + `(${arg(0, 'actor')})`;
				case 0x219:
					return rp + fn('monster_next_slot') + '()';
				case 0x21a:
					return rp + fn('desc_next_slot') + '()';
				case 0x21b:
					return (
						rp +
						fn('desc_by_sprite_id_cached') +
						`(${arg(0)}, ${arg(1, 'hex32')}) // ${bai.spriteFile(args[1].x)}`
					);
				case 0x21c: {
					let comment;
					if (args[0].type !== 'var') comment = ' // ' + monsters.monsters[args[0].x]?.name ?? '(?)';
					else comment = ' // (?)';
					return rp + fn('desc_by_monster_id_cached') + `(${arg(0)})` + comment;
				}
			}

			// defaults
			if (opcode <= 0x46) return rp + fn('CM_' + str16(opcode)) + `(${argsConcat()})`;
			else return rp + fn('BA_' + str16(opcode)) + `(${argsConcat()})`;
		};

		const update = () => {
			preview.innerHTML = '';

			const segments = options[fileSelect.value]?.[2]?.segments;
			if (!segments) {
				preview.innerHTML = 'No segments/offsets for this file for this game version';
				scriptSelect.style.display = 'none';
				return;
			}

			const segmentNames = scriptSelectNames[fileSelect.value];
			scriptSelect.replaceWith((scriptSelect = dropdown(segmentNames, 0, () => updateScript())));

			updateScript = () => {
				const script = segments[scriptSelect.value];
				preview.innerHTML = '';



				/* if (scriptRenderer.value === 0) {
					// Renderer: basic
					const eventOffsets = new Map();
					eventOffsets.set(14, 'default_init'); // might be overwritten by a *real* handler

					const names = ['other_monster_turn', 'init', 'monster_turn', 'player_turn', 'unknown5', 'unknown6'];
					const offsetList = [];
					for (let i = 0; i < 6; ++i) {
						const offset = script.getInt16(i * 2 + 2, true);
						if (!offset) continue;
						const loc = offset + i * 2 + 2;
						eventOffsets.set(loc, names[i]);
						offsetList.push(`<li>${names[i]} @ <code>${str16(loc)}</code></li>`);
					}

					if (offsetList.length) addHTML(preview, `<ul>${offsetList.join('')}</ul>`);

					const parts = [];
					let o = 14;
					for (; o + 5 < script.byteLength; ) {
						const startO = o;
						const cmd = script.getUint16(o, true);
						const flags = script.getUint32(o + 2, true);
						const command = bai.dialect[cmd];
						if (!command) break;

						let prefix = `<span style="color: var(--fg-dim);">${str16(o)}</span> `;
						const evOffset = eventOffsets.get(o);
						if (evOffset) prefix = `<span style="color: var(--fg-dim);">${str16(o)} ${evOffset}</span> `;
						else prefix = `<span style="color: var(--fg-dim);">${str16(o)}</span> `;
						o += 6;

						if (command.returns) {
							prefix += `var[0x${str16(script.getUint16(o, true))}] = `;
							o += 2;
						}

						const args = [];
						for (let i = 0; i < command.args.length; ++i) {
							if (flags & (1 << i)) {
								args.push(`var[0x${str16(script.getUint16(o, true))}]`);
								o += 2; // variable
							} else if (command.args[i] === 0)
								(args.push(script.getUint8(o)), ++o); // u8
							else if (command.args[i] === 1)
								(args.push(script.getUint16(o, true)), (o += 2)); // u16
							else if (command.args[i] === 2)
								(args.push(script.getUint32(o, true)), (o += 4)); // u32
							else if (command.args[i] === 3)
								(args.push(script.getInt8(o)), ++o); // s8
							else if (command.args[i] === 4)
								(args.push(script.getInt16(o, true)), (o += 2)); // s16
							else if (command.args[i] === 5)
								(args.push(script.getInt32(o, true)), (o += 4)); // s32
							else if (command.args[i] === 6) {
								const x = script.getInt16(o, true);
								args.push(`(fx16)${x / 256}`);
								o += 2; // fixed-point (8.8?)
							} else if (command.args[i] === 7) {
								const x = script.getInt32(o, true);
								args.push(`(fx32)${x / 4096}`);
								o += 4; // fixed-point (20.12)
							}
						}

						if (o > script.byteLength) break;

						if (cmd <= 0x46) parts.push(`${prefix}CM_${str16(cmd)}(${args.join(', ')})`);
						else parts.push(`${prefix}BA_${str16(cmd)}(${args.join(', ')})`);
					}

					addHTML(preview, `<div><code>${parts.map(x => `<div>${x}</div>`).join(' ')}</code></div>`);
				} else if (scriptRenderer.value === 1) {
					// Renderer: colorful + flow
					const parsed = bai.parse(script);

					const arg = ({ type, x }, context) => {
						if (type === 'var') return bai.variable(x, context);
						else return bai.value(x, context);
					};
					const operators = ['==', '!=', '<', '>', '<=', '>=', '&', '|', '^']; // unary operators unused

					// #1 : prepare quick index
					const offsetToCommandIdx = new Map();
					for (let i = 0; i < parsed.length; ++i) offsetToCommandIdx.set(parsed[i].offsetLeft, i);

					// #2 : find function calls. jumps won't happen between functions.
					const functionLabels = new Map();
					functionLabels.set(0xe, 'default_init');
					for (const cmd of parsed) {
						let offset;
						if (cmd.opcode === 3 && cmd.args[0].x === 1) offset = cmd.args[1].x;
						if (cmd.opcode === 0x47 || cmd.opcode === 0x48 || cmd.opcode === 0x49) offset = cmd.args[2].x;

						if (offset !== undefined) {
							const to = cmd.offsetRight + offset;
							functionLabels.set(to, `fun_${str16(to)}`);
						}
					}

					const headerU16 = bufToU16(script);
					if (headerU16[1]) functionLabels.set(headerU16[1] + 2, 'other_monster_turn');
					if (headerU16[2]) functionLabels.set(headerU16[2] + 4, 'init');
					if (headerU16[3]) functionLabels.set(headerU16[3] + 6, 'monster_turn');
					if (headerU16[4]) functionLabels.set(headerU16[4] + 8, 'player_turn');
					if (headerU16[5]) functionLabels.set(headerU16[5] + 10, 'unknown5');
					if (headerU16[6]) functionLabels.set(headerU16[6] + 12, 'unknown6');

					// #3 : replace tree with functions, and explore those functions
					const tree = [...parsed];
					for (let i = 0; i < tree.length; ++i) {
						const label = functionLabels.get(tree[i].offsetLeft);
						if (!label) continue;

						// function found: go until the next function
						let fnEnd = i;
						for (let j = i + 1; j < tree.length; ++j) {
							if (tree[j].opcode === -1) break;
							if (functionLabels.has(tree[j].offsetLeft)) break;
							fnEnd = j;
						}

						const children = tree.splice(i, fnEnd - i + 1);
						tree.splice(i, 0, {
							separators: [`${keyword('def')} ${fn(label)}() {`, `}`],
							content: [children],
							offsetLeft: undefined /* children[0].offsetLeft * /,
							offsetsMiddle: [],
							offsetRight: undefined /* children[children.length - 1].offsetRight * /,
						});

						const explore = branch => {
							branchLoop: for (let j = 0; j < branch.length; ++j) {
								const outer = branch[j];
								// BA_0002(op, a, b, 0, +offset)
								if (outer.opcode === 2 && outer.args[3].x === 0 && outer.args[4].x > 0) {
									const to = outer.offsetRight + outer.args[4].x;
									let leftIdx = j + 1;
									const left = branch[leftIdx];
									let rightIdx = leftIdx;
									for (let k = leftIdx + 1; k < branch.length; ++k) {
										if (branch[k].offsetLeft === to) break;
										rightIdx = k;
									}
									const right = branch[rightIdx];
									if (!left || !right) continue;

									// make sure all jumps within this block STAY within this block.
									// because if they didn't, the expansion would be even more confusing
									for (let k = leftIdx; k < rightIdx; ++k) {
										if (branch[k].opcode === 2) {
											const withinTo = branch[k].offsetRight + branch[k].args[4].x;
											if (left.offsetLeft <= withinTo && withinTo <= right.offsetRight);
											else continue branchLoop;
										} else if (branch[k].opcode === 3 && branch[k].args[0].x !== 1) {
											const withinTo = branch[k].offsetRight + branch[k].args[1].x;
											if (left.offsetLeft <= withinTo && withinTo <= right.offsetRight);
											else continue branchLoop;
										}
									}

									// if the last command in the if-block is a jump (NOT a function call), this could
									// be an if-else block instead
									if (right.opcode === 3 && right.args[0].x !== 1) {
										const withinTo = right.offsetRight + right.args[1].x;
										if (right.offsetRight < withinTo) {
											// this is an if-else block
											const ifLeftIdx = leftIdx;
											const ifRightIdx = rightIdx - 1;
											const elseLeftIdx = rightIdx + 1;
											let elseRightIdx = elseLeftIdx;
											for (let k = elseLeftIdx; k < branch.length; ++k) {
												if (branch[k].offsetLeft === withinTo) break;
												elseRightIdx = k;
											}
											const elseRight = branch[elseRightIdx];
											if (elseRight) {
												// don't do any validation yet, let's see what happens
												const childrenElse = branch.splice(
													elseLeftIdx,
													elseRightIdx - elseLeftIdx + 1,
												);
												const childrenIf = branch.splice(ifLeftIdx, ifRightIdx - ifLeftIdx + 1);
												const ifelse = (branch[j] = {
													separators: [
														`${keyword('if')} (${arg(outer.args[1])} ${operator(operators[outer.args[0].x])} ${arg(outer.args[2])}) {`,
														`} ${keyword('else')} {`,
														`}`,
													],
													content: [childrenIf, childrenElse],
													offsetLeft: outer.offsetLeft,
													offsetsMiddle: [right.offsetLeft],
													offsetRight: undefined /* elseRight.offsetRight * /,
												});
												branch.splice(j + 1, 1); // delete the "else" command

												explore(childrenIf);
												explore(childrenElse);

												if (childrenElse.length === 1 && childrenElse[0].separators) {
													const inner = childrenElse[0];
													// TODO maybe won't look too right if i introduce a loop { or smth
													ifelse.separators.pop();
													ifelse.separators.pop();
													ifelse.separators.push(
														`} ${keyword('else')} ${inner.separators[0]}`,
													);
													for (let k = 1; k < inner.separators.length; ++k) {
														ifelse.separators.push(inner.separators[k]);
													}

													ifelse.offsetsMiddle.pop();
													ifelse.offsetsMiddle.push(inner.offsetLeft);
													ifelse.offsetsMiddle.push(...inner.offsetsMiddle);

													ifelse.content.pop();
													ifelse.content.push(...inner.content);
												}
												continue;
											}
										}
									}

									const children = branch.splice(leftIdx, rightIdx - leftIdx + 1);
									branch[j] = {
										// replace `outer` with a block
										separators: [
											`${keyword('if')} (${arg(outer.args[1])} ${operator(operators[outer.args[0].x])} ${arg(outer.args[2])}) {`,
											`}`,
										],
										content: [children],
										offsetLeft: outer.offsetLeft,
										offsetsMiddle: [],
										offsetRight: undefined /*right.offsetRight* /,
									};
									explore(children);
								}
							}
						};
						explore(children);
					}

					const explore = (branch, indent) =>
						branch
							.map(block => {
								const prefix = offsetLeft =>
									`${offsetLeft !== undefined ? str16(offsetLeft) : '----'} ${'&nbsp;'.repeat(indent * 4)}`;
								if (block.opcode === undefined) {
									const parts = [];
									parts.push(`${prefix(block.offsetLeft)}${block.separators[0]}`);
									for (let i = 0; i < block.content.length - 1; ++i) {
										parts.push(...explore(block.content[i], indent + 1));
										parts.push(`${prefix(block.offsetsMiddle[i])}${block.separators[i + 1]}`);
									}
									parts.push(...explore(block.content[block.content.length - 1], indent + 1));
									parts.push(
										`${prefix(block.offsetRight)}${block.separators[block.separators.length - 1]}`,
									);
									return parts;
								} else if (block.opcode === -2) {
									// raw string
									return `${prefix}${block.str}`;
								} else if (block.opcode === -1) {
									// raw data
									return `${prefix(block.offsetLeft)}${text(bytes(block.offsetLeft, block.offsetRight - block.offsetLeft, script))}</span>`;
								} else {
									// command
									const { opcode, returnTarget, args, offsetLeft, offsetRight } = block;
									return (
										prefix(offsetLeft) +
										bai.command(
											script,
											opcode,
											returnTarget,
											args,
											offsetLeft,
											offsetRight,
											functionLabels,
										)
									);
								}
							})
							.flat();
					addHTML(
						preview,
						`<div style="color: var(--overlay2);"><code>${explore(tree, 0).join('<br>')}</code></div>`,
					);
				}
				*/
			};
			updateScript();
		};
		update();

		return bai;
	}));
};
