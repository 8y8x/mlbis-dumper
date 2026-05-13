'use strict';

window.initRtti = () => {
	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: RTTI VTables                                                                                         |
	// +---------------------------------------------------------------------------------------------------------------+

	const vtables = (window.vtables = createSection('RTTI VTables', section => {
		const vtables = {};

		const picked = new Set();

		const overlapDisplay = document.createElement('div');
		overlapDisplay.style.cssText = `height: 20px; width: 100%; background: var(--surface0); position: relative;`;
		section.appendChild(overlapDisplay);

		const scanStatus = document.createElement('div');
		scanStatus.textContent = '0 overlays selected';
		section.appendChild(scanStatus);

		const overlapping = new Set();
		const highlightOverlap = () => {
			overlapping.clear();

			for (const ov1 of picked) {
				for (const ov2 of picked) {
					if (ov1.id >= ov2.id) continue;
					if (ov1.ramStart < ov2.ramStart + ov2.ramSize && ov2.ramStart < ov1.ramStart + ov1.ramSize) {
						overlapping.add(ov1);
						overlapping.add(ov2);
					}
				}
			}

			for (const ov of picked) {
				const bad = overlapping.has(ov);
				ov.overlapBox.style.background = bad ? '#ff84a833' : 'var(--surface1)';
				ov.overlapBox.style.borderColor = bad ? 'var(--red)' : 'var(--overlay2)';
			}

			if (overlapping.size) {
				scanStatus.style.color = 'var(--red)';
				scanStatus.textContent = `${overlapping.size} overlapping: ${[...overlapping].map(x => x.name).join(', ')}`;
			} else {
				scanStatus.style.color = '';
				scanStatus.textContent = `No overlaps, ${picked.size} picked`;
			}
		};

		const addEntry = (name, id, bufProvider, ramStart, ramSize) => {
			const overlapBox = document.createElement('div');
			overlapBox.style.cssText =
				`position: absolute; top: 0; ` +
				`left: ${((ramStart - 0x02000000) / 0x400000) * 100}%; width: ${(ramSize / 0x400000) * 100}%; ` +
				`height: 20px; background: var(--surface1); border: 1px solid var(--overlay2); display: none; ` +
				`z-index: 2; opacity: 0.333;`;
			overlapDisplay.appendChild(overlapBox);

			const container = { overlapBox, name, id, bufProvider, ramStart, ramSize };

			const check = checkbox(name, false, checked => {
				overlapBox.style.opacity = checked ? '1' : '0.333';
				overlapBox.style.zIndex = checked ? '0' : '2';

				if (checked) picked.add(container);
				else {
					picked.delete(container);
					overlapBox.style.background = 'var(--surface1)';
					overlapBox.style.borderColor = 'var(--overlay2)';
				}

				highlightOverlap();
			});
			section.appendChild(check);

			check.addEventListener('mouseover', () => {
				if (check.checked) return;
				overlapBox.style.display = '';
			});
			check.addEventListener('mouseout', () => {
				if (check.checked) return;
				overlapBox.style.display = 'none';
			});
		};
		addEntry('ARM9&nbsp;', -2, () => fs.arm9, headers.arm9RamOffset, fs.arm9.byteLength);
		addEntry('ARM7&nbsp;', -1, () => fs.arm7, headers.arm7RamOffset, fs.arm7.byteLength);
		for (const ov of ovt.overlays) {
			addEntry(
				`ov${String(ov.id).padStart(3, '0')}`,
				ov.id,
				() => fs.overlay(ov.id, true),
				ov.ramStart,
				ov.ramSize,
			);
		}

		const scanButton = button('Scan', () => {
			scanPreview.innerHTML = '';

			// MLBIS's RTTI info seems to follow this structure:
			// https://itanium-cxx-abi.github.io/cxx-abi/abi.html#rtti
			// - MLBIS only uses abi::__class_type_info, abi::__si_class_type_info, and abi::__vmi_class_type_info, not
			//   the other derived types of std::type_info
			// - Mangled names do not start with "_Z"

			const errors = [];
			const checkErrors = () => {
				if (!errors.length) return;

				addHTML(scanPreview, `Errors: <ul>${errors.map(x => '<li>' + x + '</li>').join('')}</ul>`);
				for (let i = 0; i < errors.length - 1; ++i) console.error(errors[i]);
				throw errors[errors.length - 1];
			};

			// #1 : copy all overlays into a temporary buffer (it's "rebased")
			const dat = new DataView(new ArrayBuffer(0x400000));
			const u8 = bufToU8(dat);
			const s32 = bufToS32(dat);
			for (const ov of picked) {
				bufToS32(dat).set(bufToS32(ov.bufProvider()), (ov.ramStart - 0x02000000) / 4);
			}

			// #2 : search for mangled names, and demangle them
			const offsetToDemangled = new Map();
			const demangledToOffsets = new Map();
			let lastInvalid = -1;
			for (let o = 0; o < 0x400000; ++o) {
				const byte = u8[o];
				if (
					(0x41 <= byte && byte <= 0x5a) /* A-Z */ ||
					(0x61 <= byte && byte <= 0x7a) /* a-z */ ||
					(0x30 <= byte && byte <= 0x39) /* 0-9 */ ||
					byte === 0x5f /* _ */
				)
					continue;

				const start = lastInvalid + 1;
				const end = o;
				lastInvalid = o;

				const length = end - start;
				if (length < 4) continue; // classes can be as short as "clFS"
				if (byte !== 0) continue; // string must be null-terminated

				// these are examples of mangled names:
				// - 10clYanaAnim, 5clPaf, St9type_info, 10inYanaUnit
				// - N8nsObjSys11clCellAnimeE, N10__cxxabiv117__class_type_infoE
				// note the "cl", "ns", and "in" prefixes are part of the original names, in fact, the developers break
				// the convention with "N11clBtlObjCsr15clBtlObjCsrCopyE"

				let o2 = start;
				const readUnqualifiedName = () => {
					let len = 0;
					for (let i = 0; i < 3 && o2 < end; ++i, ++o2) {
						if (!(0x30 <= u8[o2] && u8[o2] <= 0x39) /* 0-9 */) break;
						len *= 10;
						len += u8[o2] - 0x30;
					}

					if (len > end - o2) return undefined;
					const str = latin1(o2, len, dat);
					o2 += len;
					return str;
				};

				const readUnscopedName = () => {
					let prefix = '';
					if (u8[o2] === 0x53 /* S */ && u8[o2 + 1] === 0x74 /* t */) {
						prefix = 'std::';
						o2 += 2;
					}

					return prefix + readUnqualifiedName();
				};

				// readName
				let demangled;
				if (u8[o2] === 0x4e /* N */) {
					// namespace
					++o2;
					// assume no CV-qualifiers or ref-qualifiers
					const prefix = readUnqualifiedName();
					const name = readUnqualifiedName();
					if (!prefix || !name) continue;

					if (u8[o2++] !== 0x45 /* E */) continue;
					if (o2 !== end || u8[o2] !== 0) continue;

					demangled = prefix + '::' + name;
				} else {
					demangled = readUnscopedName();
					if (o2 !== end || u8[o2] !== 0) continue;
				}

				const offsets = demangledToOffsets.get(demangled);
				if (offsets) offsets.push(start);
				else demangledToOffsets.set(demangled, [start]);

				offsetToDemangled.set(start, demangled);
			}

			// #3 : find pointers to those strings
			const demangledToReferences = new Map();
			for (let o = 0; o < 0x400000; o += 4) {
				const value = dat.getUint32(o, true);
				// rule out mostly anything that isn't a pointer
				if (!(0x02000000 <= value && value < 0x02400000)) continue;

				const demangled = offsetToDemangled.get(value - 0x02000000);
				if (!demangled) continue;

				// value is a const char* pointing to this mangled string
				// but it might not be a type_info struct ("clTask" has the unfortunately simple address 02050000)
				// so, assuming this would be a type_info struct, ensure the above u32 points to some vtable
				const previousValue = dat.getUint32(o - 4, true);
				if (!(0x02000000 <= previousValue && previousValue <= 0x02400000)) continue;
				const potentialVtableFirstFunction = dat.getUint32(previousValue - 0x02000000, true);
				if (!(0x02000000 <= potentialVtableFirstFunction && potentialVtableFirstFunction <= 0x02400000))
					continue;

				// this is probably a real reference
				const refs = demangledToReferences.get(demangled);
				if (refs) refs.push({ from: o, to: value - 0x02000000 });
				else demangledToReferences.set(demangled, [{ from: o, to: value - 0x02000000 }]);
			}

			// #4 : validate that the name references are 1-1
			for (const [demangled, offsets] of demangledToOffsets) {
				const refs = demangledToReferences.get(demangled);
				if (refs?.length !== offsets.length) {
					errors.push(
						`${demangled} is defined at ${offsets.length} places ` +
							`(${offsets.map(x => str32(x + 0x02000000)).join(', ')}) but referenced at ` +
							`${refs?.length ?? 0} places instead ` +
							`${refs ? '(' + refs.map(x => str32(x.from + 0x02000000)).join(', ') + ')' : ''}`,
					);
					continue;
				}

				const usedOffsets = new Set();
				for (const { from, to } of refs) {
					if (usedOffsets.has(to)) {
						errors.push(
							`${demangled} @ ${str32(from + 0x02000000)} is referenced more than once, ` +
								`references: ${refs
									.filter(ref => ref.to === to)
									.map(x => str32(x.from + 0x02000000))
									.join(', ')}`,
						);
					}

					usedOffsets.add(to);
				}
			}
			checkErrors();

			// #5 : from the name references, build out type_info-derived structs
			const demangledToTypeInfos = new Map();
			const offsetToTypeInfo = new Map();
			for (const [demangled, refs] of demangledToReferences) {
				const typeInfos = [];
				demangledToTypeInfos.set(demangled, typeInfos);
				for (const ref of refs) {
					// this is also the reference to the implied vtable of the base class
					// (__class_type_info, __si_class_type_info, __vmi_class_type_info)
					const typeInfoOffset = ref.from - 4;
					// TODO: validate these pointers on the way
					const baseVtablePtr = dat.getUint32(typeInfoOffset, true) - 0x02000000;
					const baseTypeInfoOffset = dat.getUint32(baseVtablePtr - 4, true) - 0x02000000;
					const baseTypeInfoNamePtr = dat.getUint32(baseTypeInfoOffset + 4, true) - 0x02000000;
					const baseTypeInfoName = offsetToDemangled.get(baseTypeInfoNamePtr);

					let typeInfo;
					if (baseTypeInfoName === '__cxxabiv1::__class_type_info') {
						// no base class
						typeInfo = {
							offset: typeInfoOffset,
							name: demangled,
							type: baseTypeInfoName,
							baseTypeInfoOffsets: [],
							dat: sliceDataView(dat, typeInfoOffset, typeInfoOffset + 8),
						};
					} else if (baseTypeInfoName === '__cxxabiv1::__si_class_type_info') {
						// single, public, non-virtual base class
						typeInfo = {
							offset: typeInfoOffset,
							name: demangled,
							type: baseTypeInfoName,
							baseTypeInfoOffsets: [
								{
									at: dat.getUint32(typeInfoOffset + 8, true) - 0x02000000,
									vptrFieldOffset: 0,
									virtual: false,
									public: true,
								},
							],
							dat: sliceDataView(dat, typeInfoOffset, typeInfoOffset + 12),
						};
					} else if (baseTypeInfoName === '__cxxabiv1::__vmi_class_type_info') {
						const classFlags = dat.getUint32(typeInfoOffset + 8, true);
						const baseCount = dat.getUint32(typeInfoOffset + 12, true);
						const baseTypeInfoOffsets = [];
						for (let i = 0, o = typeInfoOffset + 16; i < baseCount; ++i, o += 8) {
							const baseTypeInfoOffset = dat.getUint32(o, true) - 0x02000000;
							const offsetFlags = dat.getInt32(o + 4, true);
							baseTypeInfoOffsets.push({
								at: baseTypeInfoOffset,
								vptrFieldOffset: Math.abs(offsetFlags >> 8),
								virtual: !!(offsetFlags & 1),
								public: !!(offsetFlags & 2),
							});
						}

						typeInfo = {
							offset: typeInfoOffset,
							name: demangled,
							type: baseTypeInfoName,
							baseTypeInfoOffsets,
							dat: sliceDataView(dat, typeInfoOffset, typeInfoOffset + 16 + baseCount * 8),
						};
					} else {
						errors.push(
							`${demangled}'s type_info struct @ ${str32(typeInfoOffset + 0x02000000)} inherits ` +
								`from unhandled type_info derivative ${baseTypeInfoName}`,
						);
						continue;
					}

					typeInfos.push(typeInfo);
					offsetToTypeInfo.set(typeInfoOffset, typeInfo);
				}
			}
			checkErrors();

			// #6 : make sure that the duplicate type_infos found exactly match
			for (const [demangled, typeInfos] of demangledToTypeInfos) {
				if (typeInfos.length < 2) continue;
				const u8First = bufToU32(typeInfos[0].dat);

				for (let i = 1; i < typeInfos.length; ++i) {
					const u8Second = bufToU32(typeInfos[i].dat);

					let equivalent = u8First.length === u8Second.length;
					for (let o = 0; o < u8First.length && equivalent; ++o) {
						equivalent ||= u8First[o] === u8Second[o];
					}

					if (equivalent) continue; // ok
					errors.push(
						`${demangled} has duplicate type_infos that aren't equivalent @ ` +
							`${str32(typeInfos[0].offset + 0x02000000)} and ${str32(typeInfos[i].offset + 0x02000000)}`,
					);
				}
			}
			checkErrors();

			// #7 : make sure that type_infos reference real base type_infos
			for (const [demangled, typeInfos] of demangledToTypeInfos) {
				const typeInfo = typeInfos[0];
				for (const baseTypeInfoOffset of typeInfo.baseTypeInfoOffsets) {
					if (offsetToTypeInfo.has(baseTypeInfoOffset.at)) continue;

					errors.push(
						`${demangled}'s type_info @ ${str32(typeInfo.offset + 0x02000000)} references a base ` +
							`type_info @ ${str32(baseTypeInfoOffset.at + 0x02000000)}, but it doesn't exist`,
					);
				}
			}
			checkErrors();

			// #8 : find the vtables associated with each class's type_info
			const typeInfoToVtablePtrs = new Map();
			for (let o = 0; o < 0x400000; o += 4) {
				const value = dat.getUint32(o, true);
				if (!(0x02000000 <= value && value <= 0x02400000)) continue;

				const typeInfo = offsetToTypeInfo.get(value - 0x02000000);
				if (!typeInfo) continue;

				const vtableOffset = o + 4;

				// make sure this really is a vtable, by checking that at least the first member is also a pointer
				const firstVtableMember = dat.getUint32(vtableOffset, true);
				if (!(0x02000000 <= firstVtableMember && firstVtableMember <= 0x02400000)) continue;

				// also check that vptrFieldOffset is not absurdly huge
				const vptrFieldOffset = -dat.getInt32(o - 4, true);
				if (!(-65536 <= vptrFieldOffset && vptrFieldOffset <= 65536)) continue;

				console.log(`found vtable for ${typeInfo.name} at ${str32(vtableOffset + 0x02000000)}`);

				if (typeInfo.type === '__cxxabiv1::__class_type_info') {
					// no base class, but this class still has a vtable
					const previousVtablePtrs = typeInfoToVtablePtrs.get(typeInfo);
					if (previousVtablePtrs) {
						const [prevVptrFieldOffset, at] = previousVtablePtrs.entries().next().value;
						errors.push(
							`Base class ${typeInfo.name}'s type_info @ ` +
								`${str32(typeInfo.offset + 0x02000000)} already has an associated vtable at ` +
								`${str32(at + 0x02000000)} (vptr at field_0x${prevVptrFieldOffset.toString(16)}), ` +
								`but a new one was found at ${str32(vtableOffset + 0x02000000)} (vptr at ` +
								`field_0x${vptrFieldOffset.toString(16)})`,
						);
						continue;
					}

					typeInfoToVtablePtrs.set(typeInfo, new Map([[vptrFieldOffset, [vtableOffset]]]));
				} else {
					const vtablePtrs = typeInfoToVtablePtrs.get(typeInfo);
					if (vtablePtrs) {
						// make sure this vptr field hasn't already been assigned a vtable
						const prevVtablePtrs = vtablePtrs.get(vptrFieldOffset);
						if (prevVtablePtrs) prevVtablePtrs.push(vtableOffset);
						else vtablePtrs.set(vptrFieldOffset, [vtableOffset]);
					} else {
						typeInfoToVtablePtrs.set(typeInfo, new Map([[vptrFieldOffset, [vtableOffset]]]));
					}
				}
			}
			checkErrors();

			// #9 : propagate public/virtual info about base classes from a type_info to its base's type_info
			const typeInfoToClassAttr = new Map();
			for (const [demangled, typeInfos] of demangledToTypeInfos) {
				for (const baseTypeInfoOffset of typeInfos[0].baseTypeInfoOffsets) {
					const baseTypeInfo = offsetToTypeInfo.get(baseTypeInfoOffset.at); // must be valid, by #7
					const previousAttr = typeInfoToClassAttr.get(baseTypeInfo);
					if (previousAttr) {
						// make sure the info is not mismatched (a base class can't be public/virtual in one place but
						// not in another)
						if (
							previousAttr.public === baseTypeInfoOffset.public ||
							previousAttr.virtual === baseTypeInfoOffset.virtual
						)
							continue;

						errors.push(
							`${demangled}'s type_info @ ${str32(typeInfos[0].offset + 0x02000000)} ` +
								`marks base class ${baseTypeInfo.name} as public=${baseTypeInfoOffset.public} & ` +
								`virtual=${baseTypeInfoOffset.virtual}, but it was previously marked as ` +
								`public=${previousAttr.public} & virtual=${previousAttr.virtual} by ` +
								`${previousAttr.blame}`,
						);
					} else {
						typeInfoToClassAttr.set(baseTypeInfo, {
							public: baseTypeInfoOffset.public,
							virtual: baseTypeInfoOffset.virtual,
							blame: `${demangled} (type_info @ ${str32(typeInfos[0].offset + 0x02000000)})`,
						});
					}
				}
			}

			// #10 : display info
			const table = document.createElement('table');
			table.className = 'bordered';
			addHTML(
				table,
				`<tr>
					<th>Name</th>
					<th>Base Classes</th>
					<th>VTables</th>
					<th>type_infos</th>
				</tr>`,
			);

			for (const [demangled, typeInfos] of demangledToTypeInfos) {
				const typeInfo = typeInfos[0];
				const classAttr = typeInfoToClassAttr.get(typeInfo);

				let nameField = demangled;
				if (classAttr) {
					if (classAttr.virtual && !classAttr.public) nameField += '<br>(virtual, private)';
					else if (classAttr.virtual) nameField += '<br>(virtual)';
					else if (!classAttr.public) nameField += '<br>(private)';
				} else {
					nameField += '<br>(no known subclasses)';
				}

				const baseClassesField = [...typeInfo.baseTypeInfoOffsets]
					.sort((a, b) => a.vptrFieldOffset - b.vptrFieldOffset)
					// must be valid, by #7
					.map(x => `field_0x${x.vptrFieldOffset.toString(16)} - ${offsetToTypeInfo.get(x.at).name}`)
					.join('<br>');

				const vtablePtrs = [];
				for (const otherTypeInfo of typeInfos) {
					const thisVtablePtrs = typeInfoToVtablePtrs.get(otherTypeInfo);
					if (thisVtablePtrs) vtablePtrs.push(...thisVtablePtrs);
				}

				let vtablesField = '';
				if (vtablePtrs.length) {
					vtablesField = vtablePtrs
						.sort((a, b) => a[0] - b[0])
						.map(([vptrFieldOffset, vtableOffsets]) => {
							const prefix = `field_0x${vptrFieldOffset.toString(16)} - `;
							return vtableOffsets
								.map((y, i) => {
									if (!i) return prefix + str32(y + 0x02000000);
									else return '&nbsp;'.repeat(prefix.length) + str32(y + 0x02000000);
								})
								.join('<br>');
						})
						.join('<br>');
				}

				const typeInfosField = typeInfos.map(x => str32(x.offset + 0x02000000)).join('<br>');

				addHTML(
					table,
					`<tr style="font-family: 'Red Hat Mono'; text-align: center;">
						<td>${nameField || '-'}</td>
						<td>${baseClassesField || '-'}</td>
						<td>${vtablesField || '-'}</td>
						<td>${typeInfosField}</td>
					</tr>`,
				);
			}
			scanPreview.appendChild(table);
		});
		section.appendChild(scanButton);

		const scanPreview = document.createElement('div');
		section.appendChild(scanPreview);

		return vtables;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: RTTI Inheritance Trees                                                                               |
	// +---------------------------------------------------------------------------------------------------------------+

	const rtti = (window.rtti = createSection('RTTI Inheritance Trees', section => {
		const rtti = {};

		rtti.demangle = dat => {
			const u8 = bufToU8(dat);

			// these are examples of mangled names:
			// - 10clYanaAnim, 5clPaf, St9type_info, 10inYanaUnit
			// - N8nsObjSys11clCellAnimeE, N10__cxxabiv117__class_type_infoE
			// note the "cl", "ns", and "in" prefixes are part of the original names, in fact, the developers break
			// the convention with "N11clBtlObjCsr15clBtlObjCsrCopyE"

			let o = 0;
			const readUnqualifiedName = () => {
				let len = 0;
				for (let i = 0; i < 3 && o < u8.length; ++i, ++o) {
					if (!(0x30 <= u8[o] && u8[o] <= 0x39) /* 0-9 */) break;
					len *= 10;
					len += u8[o] - 0x30;
				}

				if (len > u8.length - o) return undefined;
				const str = latin1(o, len, dat);
				o += len;
				return str;
			};

			const readUnscopedName = () => {
				let prefix = '';
				if (u8[o] === 0x53 /* S */ && u8[o + 1] === 0x74 /* t */) {
					prefix = 'std::';
					o += 2;
				}

				return prefix + readUnqualifiedName();
			};

			// readName
			let demangled;
			if (u8[o] === 0x4e /* N */) {
				// namespace
				++o;
				// assume no CV-qualifiers or ref-qualifiers
				const prefix = readUnqualifiedName();
				const name = readUnqualifiedName();
				if (!prefix || !name) return;

				if (u8[o++] !== 0x45 /* E */) return;
				if (o !== u8.length) return;

				demangled = prefix + '::' + name;
			} else {
				demangled = readUnscopedName();
				if (o !== u8.length) return;
			}

			return demangled;
		};

		const scanButton = button('Scan', () => {
			section.innerHTML = ''; // delete the "Scan" button

			const error = msg => {
				addHTML(section, `<div style="color: var(--red);">${msg}</div>`);
				throw new Error(msg);
			};

			// don't add any arm7 code
			const dats = [];
			const datBases = new Map();
			const datEnds = new Map();
			const datNames = new Map();
			dats.push(fs.arm9);
			datBases.set(fs.arm9, headers.arm9RamOffset);
			datEnds.set(fs.arm9, headers.arm9RamOffset + fs.arm9.byteLength);
			datNames.set(fs.arm9, 'ARM9');
			for (const ov of ovt.overlays) {
				const dat = fs.overlay(ov.id, true);
				dats.push(dat);
				datBases.set(dat, ov.ramStart);
				datEnds.set(dat, ov.ramStart + ov.ramSize);
				datNames.set(dat, `ov${ov.id}`);
			}

			const scanString = (dat, str) => {
				const strBytes = new Uint8Array(str.length);
				for (let i = 0; i < str.length; ++i) strBytes[i] = str.charCodeAt(i);

				let matchedLength = 0;
				for (let o = 0; o < dat.byteLength; ++o) {
					if (dat.getUint8(o) === strBytes[matchedLength]) {
						++matchedLength;
						if (matchedLength === strBytes.length) return o + 1 - matchedLength;
					} else if (matchedLength) {
						o -= matchedLength;
						matchedLength = 0;
					}
				}
			};

			const scanStringEverywhere = str => {
				for (let i = 0; i < dats.length; ++i) {
					const offset = scanString(dats[i], str);
					if (offset) return [dats[i], datBases.get(dats[i]) + offset];
				}
				error(`scanStringEverywhere: couldn't find string ${str}, this game probably doesn't have RTTI info`);
			};

			const scan32 = (dat, value) => {
				for (let o = 0; o < dat.byteLength; o += 4) {
					if (dat.getUint32(o, true) === value) return datBases.get(dat) + o;
				}
			};

			const scan32Multi = (dat, value) => {
				const base = datBases.get(dat);
				const addrs = [];
				for (let o = 0; o < dat.byteLength; o += 4) {
					if (dat.getUint32(o, true) === value) addrs.push(base + o);
				}
				return addrs;
			};

			// #1 : search for the type_info's of the ABI classes (__class_type_info, ...)
			rtti.classes = new Map();
			const registerTypeInfoByName = name => {
				const stringAddr = scanString(fs.arm9, name);
				if (!stringAddr) error(`Couldn't find string ${name} in the ARM9`);

				const ref = scan32(fs.arm9, datBases.get(fs.arm9) + stringAddr);
				if (!ref) error(`typeInfoByName: found string ${name} but not a reference to it from the same overlay`);

				const demangled = rtti.demangle(textEncoder.encode(name));
				const typeInfo = { dat: fs.arm9, at: ref - 4 };
				rtti.classes.set(demangled, {
					demangled,
					typeInfo,
					allTypeInfos: [typeInfo],
					vtable: undefined,
					allVtables: [],
					subclasses: [],
					superclasses: [],
					flags: 0,
					tree: undefined,
					depth: 0,
					idealSubclasses: [],
				});
			};

			registerTypeInfoByName('St9type_info');
			try {
				registerTypeInfoByName('N10__cxxabiv117__class_type_infoE'); // BIS
			} catch (err) {
				registerTypeInfoByName('N3abi17__class_type_infoE'); // PIT
			}

			try {
				registerTypeInfoByName('N10__cxxabiv120__si_class_type_infoE'); // BIS
			} catch (err) {
				registerTypeInfoByName('N3abi20__si_class_type_infoE'); // PIT
			}

			try {
				registerTypeInfoByName('N10__cxxabiv121__vmi_class_type_infoE'); // BIS
			} catch (err) {
				console.warn(err);
			}

			addHTML(section, `<div>Found ABI type_info structs...</div>`);

			// #2 : find the ABI type_info's vtables
			for (const c of rtti.classes.values()) {
				if (c.demangled === 'std::type_info') continue; // base class type_info doesn't have a vtable

				let found = false;
				const datBase = datBases.get(fs.arm9);
				const datEnd = datEnds.get(fs.arm9);
				const refs = scan32Multi(fs.arm9, c.typeInfo.at);
				refLoop: for (const ref of refs) {
					const debased = ref - datBase;

					// a valid vtable should look like this:
					const fieldOffset = fs.arm9.getUint32(debased - 4, true);
					const vDestructor1 = fs.arm9.getUint32(debased + 4, true);
					const vDestructor2 = fs.arm9.getUint32(debased + 8, true);
					if (fieldOffset !== 0) continue;
					if (!(datBase <= vDestructor1 && vDestructor1 < datEnd)) continue;
					if (!(datBase <= vDestructor2 && vDestructor2 < datEnd)) continue;

					// and, of course, it shouldn't overlap with any type_infos:
					for (const c2 of rtti.classes.values()) {
						if (ref === c2.typeInfo.at) continue refLoop;
					}

					if (found) {
						error(`Found multiple vtable candidates in the same overlay for ABI class ${c.demangled}`);
					}
					found = true;

					const vtable = { dat: fs.arm9, at: ref + 4 };
					c.vtable = vtable;
					c.allVtables.push(vtable);
				}

				if (!found) error(`Couldn't find vtable for ABI class ${c.demangled}`);
			}

			addHTML(section, `<div>Found vtables for ABI classes...</div>`);

			// #3 : find all other type_info's by finding references to the ABI type_info vtables
			// the first field of any type_info will be a vptr to one of them
			const abiVtables = [];
			for (const c of rtti.classes.values()) {
				if (!c.vtable) continue;
				abiVtables.push(c.vtable.at);
			}

			for (const dat of dats) {
				const datBase = datBases.get(dat);
				const datEnd = datEnds.get(dat);

				for (const vptr of abiVtables) {
					const refs = scan32Multi(dat, vptr);
					refLoop: for (const ref of refs) {
						// check if this is a type_info derivative
						// just check the name field and see if it's a valid mangled name
						const namePtr = dat.getUint32(ref - datBase + 4, true);
						if (!(datBase <= namePtr && namePtr < datEnd)) continue;

						let nameEndPtr = namePtr;
						for (let i = 0; i < 128 && nameEndPtr - datBase < datEnd; ++i, ++nameEndPtr) {
							if (!dat.getUint8(nameEndPtr - datBase)) break;
						}

						// a mangled name should be at least two bytes (e.g. 1F, 1c, 1E, 1Z)
						if (nameEndPtr - namePtr <= 2) continue;
						const demangled = rtti.demangle(sliceDataView(dat, namePtr - datBase, nameEndPtr - datBase));
						if (!demangled) continue;

						// this is valid
						const c = rtti.classes.get(demangled);
						const typeInfo = { dat, at: ref };
						if (c) {
							// this type_info could have been seen already, if it's an ABI one
							if (c.typeInfo.dat === dat && c.typeInfo.at === ref) continue refLoop;
							c.allTypeInfos.push(typeInfo);
						} else {
							rtti.classes.set(demangled, {
								demangled,
								typeInfo,
								allTypeInfos: [typeInfo],
								vtable: undefined,
								allVtables: [],
								subclasses: [],
								superclasses: [],
								flags: 0,
								tree: undefined,
								depth: 0,
								idealSubclasses: [],
							});
						}
					}
				}
			}

			addHTML(section, `<div>Found type info for ${rtti.classes.size} classes...</div>`);

			// #4 : parse all type_info's and setup superclass links
			const baseClassVptr =
				rtti.classes.get('__cxxabiv1::__class_type_info')?.vtable.at ??
				rtti.classes.get('abi::__class_type_info')?.vtable.at;
			const siClassVptr =
				rtti.classes.get('__cxxabiv1::__si_class_type_info')?.vtable.at ??
				rtti.classes.get('abi::__si_class_type_info')?.vtable.at;
			const vmiClassVptr =
				rtti.classes.get('__cxxabiv1::__vmi_class_type_info')?.vtable.at ??
				rtti.classes.get('abi::__vmi_class_type_info')?.vtable.at;
			for (const c of rtti.classes.values()) {
				const dat = c.typeInfo.dat;
				const datBase = datBases.get(dat);
				const datEnd = datEnds.get(dat);
				const startO = c.typeInfo.at - datBase;
				let o = startO;

				const resolveClass = addr => {
					let localCandidate;
					const foreignCandidates = [];
					for (const c2 of rtti.classes.values()) {
						for (const typeInfo of c2.allTypeInfos) {
							if (typeInfo.at === addr) {
								if (typeInfo.dat === dat) localCandidate = c2;
								else foreignCandidates.push({ typeInfo, c: c2 });
							}
						}
					}

					// prefer type info's from the same overlay
					if (localCandidate) return localCandidate;

					if (foreignCandidates.length === 1) return foreignCandidates[0].c;
					if (foreignCandidates.length === 0)
						error(
							`resolveTypeInfo: ${c.demangled} @ ${str32(c.typeInfo.at)} inherits from some type info @ ${str32(addr)} but none was found`,
						);

					// as a last-ditch-effort, eliminate any foreign candidates from overlays that overlap
					let foreignCandidate;
					for (let i = 0; i < foreignCandidates.length; ++i) {
						const { typeInfo: foreignTypeInfo, c: foreignC } = foreignCandidates[i];
						const otherBase = datBases.get(typeInfo.dat);
						const otherEnd = datEnds.get(typeInfo.dat);
						if (datBase < otherEnd && otherBase + datEnd) continue;
						if (foreignCandidate)
							error(
								`resolveTypeInfo: ${c.demangled} inherits from some type info @ ${str32(addr)} but there are multiple candidates`,
							);
						foreignCandidate = foreignC;
					}

					if (!foreignCandidate)
						error(
							`resolveTypeInfo: ${c.demangled} inherits from some type info @ ${str32(addr)} from another overlay that overlaps this one`,
						);
					return foreignCandidate;
				};

				const vptr = dat.getUint32(o, true);
				o += 4;
				o += 4; // skip name
				if (vptr === baseClassVptr) {
					// no base classes (this itself is a base class)
				} else if (vptr === siClassVptr) {
					// single, public, non-virtual base
					const baseClass = resolveClass(dat.getUint32(o, true));
					o += 4;

					c.superclasses.push({ c: baseClass, offset: 0 });
					baseClass.subclasses.push(c);
				} else /* vptr === vmiClassVptr */ {
					o += 4;

					const baseCount = dat.getUint32(o, true);
					o += 4;
					for (let i = 0; i < baseCount; ++i) {
						const baseClass = resolveClass(dat.getUint32(o, true));
						o += 4;
						const offsetFlags = dat.getInt32(o, true);
						o += 4;

						c.superclasses.push({ c: baseClass, offset: Math.abs(offsetFlags >> 8) });
						baseClass.subclasses.push(c);
					}
				}
			}

			// #5 : explore all class trees
			for (const c of rtti.classes.values()) {
				if (c.tree) continue;

				addHTML(section, `<div style="width: 100%; height: 1px; background: var(--overlay0);"></div>`);

				const bases = [];
				const leafs = [];
				const members = [];
				const tree = Symbol();
				let queue = [c];
				while (queue.length) {
					const top = queue.pop();
					if (top.tree) continue;
					top.tree = tree;
					members.push(top);
					if (!top.superclasses.length) bases.push(top);
					if (!top.subclasses.length) leafs.push(top);

					for (const { c: c2 } of top.superclasses) queue.push(c2);
					for (const c2 of top.subclasses) queue.push(c2);
				}

				// determine a depth for all classes
				queue = [...bases];
				let queueNext = [];
				for (let depth = 0; depth < 1000 && queue.length; ++depth) {
					while (queue.length) {
						const top = queue.pop();
						top.depth = Math.max(depth, top.depth);
						for (const c of top.subclasses) queueNext.push(c);
					}

					[queue, queueNext] = [queueNext, queue];
				}

				// calculate the display of this tree
				// every branch has a width, which is the sum of the widths of its branches
				// a leaf has a fixed width
				// if a class has multiple superclasses, its branches will be put under the base that has the most
				// direct path to a depth=0 class (i.e. least amount of *alternative* subclasses and superclasses)
				// queue = [...leafs];
				// queueNext = [];

				for (let depth = Math.max(...leafs.map(x => x.depth)); depth >= 0; --depth) {
					for (const c2 of members) {
						if (c2.depth !== depth) continue;

						if (c2.idealSubclasses.length === 0) c2.width = 1;
						else {
							c2.width = 0;
							for (const c3 of c2.idealSubclasses) {
								c2.width += c3.width;
							}
						}

						if (c2.superclasses.length === 1) {
							c2.superclasses[0].c.idealSubclasses.push(c2);
						} else if (c2.superclasses.length >= 2) {
							// multiple superclasses (bases); pick the one that has the most possible paths to a
							// depth=0 class
							let candidate;
							let candidateScore;
							for (const { c: c3 } of c2.superclasses) {
								let score = 0;
								const queue2 = [...c3.subclasses];
								while (queue2.length) {
									++score;
									queue2.push(...queue2.pop().subclasses);
								}

								if (candidateScore === undefined || score > candidateScore) {
									candidate = c3;
									candidateScore = score;
								}
							}

							candidate.idealSubclasses.push(c2);
						}
					}
				}

				// now, display the tree
				const ctx = document.createElement('canvas').getContext('2d');
				ctx.font = '16px "Red Hat Text"';

				let svgWidth = 0;
				let svgHeight = 10;
				for (const c2 of bases) svgHeight += c2.width * 60;

				const svgElement = (type, attributes, inner) => {
					const el = document.createElementNS('http://www.w3.org/2000/svg', type);
					for (const [key, val] of Object.entries(attributes)) el.setAttribute(key, String(val));
					if (inner) el.textContent = inner;
					return el;
				};

				const svg = svgElement('svg', {});
				svg.style.display = 'block';

				const buildSvg = (c2, [tlX, tlY]) => {
					const textWidth = Math.ceil(ctx.measureText(c2.demangled).width);

					const ovNames = new Set();
					for (const typeInfo of c2.allTypeInfos) {
						ovNames.add(datNames.get(typeInfo.dat));
					}
					const ovNamesConcat = [...ovNames].join(', ');

					ctx.font = '12px "Red Hat Text"';
					const ovTextWidth = Math.ceil(ctx.measureText(ovNamesConcat).width);

					ctx.font = '16px "Red Hat Text"';

					const boxWidth = Math.max(textWidth, ovTextWidth) + 20;

					// classes only have one "ideal" superclass, the rest cannot be properly linked to the box, so we
					// add them in to the left
					const unideals = [];
					for (const base of c2.superclasses) {
						if (!base.c.idealSubclasses.includes(c2)) unideals.push(base);
					}

					if (unideals.length) {
						const textWidths = [];
						for (const base of unideals) {
							const textWidth = Math.ceil(ctx.measureText(base.c.demangled).width);
							textWidths.push(textWidth);
						}

						const maxTextWidth = Math.max(...textWidths);
						tlX += maxTextWidth + 15;

						// split up the unideals between the line from the ideal base
						const numTopSpaces = Math.ceil(unideals.length / 2) + 1;
						for (let i = 0; i < numTopSpaces - 1; ++i) {
							// each space y = (25 / numTopSpaces)px
							const y = ~~(tlY + (i + 1) * (25 / numTopSpaces)) + 0.5;
							svg.appendChild(
								svgElement('path', {
									d: `M${tlX - 10},${y} l10,0`,
									stroke: 'var(--red)',
									strokeWidth: 1,
								}),
							);
							svg.appendChild(
								svgElement(
									'text',
									{
										x: tlX - 15 - textWidths[i],
										y,
										'dominant-baseline': 'central',
										'font-size': '16',
										fill: 'var(--red)',
									},
									unideals[i].c.demangled,
								),
							);
						}

						const numBottomSpaces = Math.floor(unideals.length / 2) + 1;
						for (let i = 0; i < numBottomSpaces - 1; ++i) {
							const realI = i + numTopSpaces - 1;
							const y = ~~(tlY + (i + 1) * (25 / numBottomSpaces)) + 0.5 + 25;
							svg.appendChild(
								svgElement('path', {
									d: `M${tlX - 10},${y} l10,0`,
									stroke: 'var(--red)',
									strokeWidth: 1,
								}),
							);
							svg.appendChild(
								svgElement(
									'text',
									{
										x: tlX - 15 - textWidths[realI],
										y,
										'dominant-baseline': 'central',
										'font-size': '16',
										fill: 'var(--red)',
									},
									unideals[realI].c.demangled,
								),
							);
						}
					}

					svgWidth = Math.max(svgWidth, tlX + boxWidth);

					svg.appendChild(
						svgElement('rect', {
							x: tlX + 0.5,
							y: tlY + 0.5,
							width: boxWidth - 1,
							height: 50 - 1,
							fill: 'var(--blue33)',
							stroke: 'var(--blue)',
							strokeWidth: 1,
						}),
					);
					svg.appendChild(
						svgElement(
							'text',
							{
								x: tlX + boxWidth / 2,
								y: tlY + 25,
								'dominant-baseline': 'central',
								'text-anchor': 'middle',
								'font-size': '16',
								fill: 'var(--blue)',
							},
							c2.demangled,
						),
					);
					svg.appendChild(
						svgElement(
							'text',
							{
								x: tlX + boxWidth / 2,
								y: tlY + 25 - 8 - 6,
								'dominant-baseline': 'central',
								'font-size': '12',
								'text-anchor': 'middle',
								fill: 'var(--blue)',
							},
							ovNamesConcat,
						),
					);

					const startTlX = tlX + boxWidth;
					let branchMinY = Infinity;
					let branchMaxY = -Infinity;
					let y = tlY / 60 - c2.width / 2;
					for (const c3 of c2.idealSubclasses) {
						const tlY = (y + c3.width / 2) * 60;
						const adjustedTlX = buildSvg(c3, [startTlX + 50, tlY]);

						branchMinY = Math.min(branchMinY, tlY + 25);
						branchMaxY = Math.max(branchMaxY, tlY + 25);

						svg.appendChild(
							svgElement('path', {
								d: `M${startTlX + 25},${~~tlY + 0.5 + 25} L${adjustedTlX},${~~tlY + 0.5 + 25}`,
								fill: 'none',
								stroke: 'var(--text)',
								strokeWidth: '1',
							}),
						);

						y += c3.width;
					}

					if (c2.subclasses.length) {
						if (c2.idealSubclasses.length) {
							svg.appendChild(
								svgElement('path', {
									d: `M${startTlX},${~~tlY + 0.5 + 25} l25,0`,
									fill: 'none',
									stroke: c2.idealSubclasses.length ? 'var(--text)' : 'var(--red)',
									strokeWidth: '1',
								}),
							);
						}

						const unidealSubs = c2.subclasses.length - c2.idealSubclasses.length;
						if (unidealSubs) {
							// show a red indirect link for all unideal subclasses
							const path = [];
							if (c2.idealSubclasses.length) {
								// split between the main branch line, top side and bottom side
								const numTopSpaces = Math.ceil(unidealSubs / 2) + 1;
								for (let i = 0; i < numTopSpaces - 1; ++i) {
									const y = ~~(tlY + (i + 1) * (25 / numTopSpaces)) + 0.5;
									path.push(`M${startTlX},${y} l15,0`);
								}

								const numBottomSpaces = Math.floor(unidealSubs / 2) + 1;
								for (let i = 0; i < numBottomSpaces - 1; ++i) {
									const y = ~~(tlY + (i + 1) * (25 / numBottomSpaces)) + 0.5 + 25;
									path.push(`M${startTlX},${y} l15,0`);
								}
							} else {
								// no split
								const numSpaces = unidealSubs + 1;
								for (let i = 0; i < numSpaces - 1; ++i) {
									const y = ~~(tlY + (i + 1) * (50 / numSpaces)) + 0.5;
									path.push(`M${startTlX},${y} l15,0`);
								}
							}

							svg.appendChild(
								svgElement('path', {
									d: path.join(' '),
									fill: 'none',
									stroke: 'var(--red)',
									strokeWidth: '1',
								}),
							);
						}

						if (branchMinY !== branchMaxY) {
							svg.appendChild(
								svgElement('path', {
									d: `M${~~startTlX + 0.5 + 25},${~~branchMinY + 0.5} L${~~startTlX + 0.5 + 25},${~~branchMaxY + 0.5}`,
									fill: 'none',
									stroke: 'var(--text)',
									strokeWidth: '1',
								}),
							);
						}
					}

					return tlX;
				};

				let y = 0;
				for (const c2 of bases) {
					buildSvg(c2, [0, (y + c2.width / 2) * 60 - 30 + 10]);
					y += c2.width;
				}

				svg.setAttribute('width', svgWidth);
				svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

				section.appendChild(svg);
			}
		});
		section.appendChild(scanButton);

		return rtti;
	}));
};
