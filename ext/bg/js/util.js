/*
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


/*
 * Promise
 */

function promiseCallback(promise, callback) {
    return promise.then(result => {
        callback({result});
    }).catch(error => {
        callback({error});
    });
}


/*
 * Japanese
 */

function jpIsKanji(c) {
    const code = c.charCodeAt(0);
    return code >= 0x4e00 && code < 0x9fb0 || code >= 0x3400 && code < 0x4dc0;
}

function jpIsKana(c) {
    return wanakana.isKana(c);
}


/*
 * Commands
 */

function commandExec(command) {
    instRikai().onCommand(command);
}


/*
 * Instance
 */

function instRikai() {
    return browser.extension.getBackgroundPage().rikaichanWebEx;
}

function instDb() {
    return instRikai().translator.database;
}

/*
 * Foreground
 */

function fgBroadcast(action, params) {
    browser.tabs.query({}, tabs => {
        for (const tab of tabs) {
            browser.tabs.sendMessage(tab.id, {action: action, data: params}, () => null);
        }
    });
}

function fgOptionsSet(options) {
    fgBroadcast('optionsSet', options);
}


/*
 * Options
 */


function setIcon(toggle){
    const icon = toggle ? "/img/Rikai_new_icon_on.png" : "/img/Rikai_new_icon_off.png";
    browser.browserAction.setIcon({path: icon});
}

function optionsSetDefaults(options) {
    const defaults = {
        general: {
            enable: false,
            highlightText: true,
            tranAltTitle: true,
            selectedInLookupBar: true,
            enlargeSmallDocuments: false,
            showIconInStatusbar: true,

            showMiniHelp: true,
            useDPR: false,
            PopDY: 20
        },

        menus: {
            toggleContentMenu: true,
            lookupBarContentMenu: false,
            toggleToolsMenu: true,
            lookupToolsMenu: true
        },

        dictionaries: {},
        dictOpt:{
            hideDef: false,
            hidEx: false,
            wos: true,
            wpop: true,
            maxEntries:10,
            maxName:20
        },
        kanjiDictionary:[
            'COMP','H','L','E','DK','N','V','Y','P','IN','I','O'
        ],

        kanjiDictionaryObj:{
            COMP:true,
            H:true,
            L:true,
            E:true,
            DK:true,
            N:true,
            V:true,
            Y:true,
            P:true,
            IN:true,
            I:true,
            U:true
        }


    };

    const combine = (target, source) => {
        for (const key in source) {
            if (!target.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    };

    combine(options, defaults);
    combine(options.general, defaults.general);
    /*combine(options.scanning, defaults.scanning);
    combine(options.anki, defaults.anki);
    combine(options.anki.terms, defaults.anki.terms);
    combine(options.anki.kanji, defaults.anki.kanji);*/

    return options;
}

function optionsVersion(options) {
    const fixups = [
        () => {},
        () => {},
        () => {},
        () => {},
        () => {
            if (options.general.audioPlayback) {
                options.general.audioSource = 'jpod101';
            } else {
                options.general.audioSource = 'disabled';
            }
        },
        () => {
            options.general.showGuide = false;
        },
        () => {
            if (options.scanning.requireShift) {
                options.scanning.modifier = 'shift';
            } else {
                options.scanning.modifier = 'none';
            }
        }
    ];

    optionsSetDefaults(options);
    if (!options.hasOwnProperty('version')) {
        options.version = fixups.length;
    }

    while (options.version < fixups.length) {
        fixups[options.version++]();
    }

    return options;
}

function optionsLoad() {
    return new Promise((resolve, reject) => {
        browser.storage.local.get(null, store => resolve(store.options));
    }).then(optionsStr => {
        return optionsStr ? JSON.parse(optionsStr) : {};
    }).catch(error => {
        return {};
    }).then(options => {
        return optionsVersion(options);
    });
}

function optionsSave(options) {
    return new Promise((resolve, reject) => {
        browser.storage.local.set({options: JSON.stringify(options)}, resolve);
    }).then(() => {
        instRikai().optionsSet(options);
        fgOptionsSet(options);
    });
}


/*
 * Dictionary
 */

function dictEnabledSet(options) {
    const dictionaries = {};
    for (const title in options.dictionaries) {
        const dictionary = options.dictionaries[title];
        if (dictionary.enabled) {
            dictionaries[title] = dictionary;
        }
    }

    return dictionaries;
}

function dictConfigured(options) {
    for (const title in options.dictionaries) {
        if (options.dictionaries[title].enabled) {
            return true;
        }
    }

    return false;
}

function dictRowsSort(rows, options) {
    return rows.sort((ra, rb) => {
        const pa = (options.dictionaries[ra.title] || {}).priority || 0;
        const pb = (options.dictionaries[rb.title] || {}).priority || 0;
        if (pa > pb) {
            return -1;
        } else if (pa < pb) {
            return 1;
        } else {
            return 0;
        }
    });
}

function dictTermsSort(definitions, dictionaries=null) {
    return definitions.sort((v1, v2) => {
        const sl1 = v1.source.length;
        const sl2 = v2.source.length;
        if (sl1 > sl2) {
            return -1;
        } else if (sl1 < sl2) {
            return 1;
        }

        if (dictionaries !== null) {
            const p1 = (dictionaries[v1.dictionary] || {}).priority || 0;
            const p2 = (dictionaries[v2.dictionary] || {}).priority || 0;
            if (p1 > p2) {
                return -1;
            } else if (p1 < p2) {
                return 1;
            }
        }

        const s1 = v1.score;
        const s2 = v2.score;
        if (s1 > s2) {
            return -1;
        } else if (s1 < s2) {
            return 1;
        }

        const rl1 = v1.reasons.length;
        const rl2 = v2.reasons.length;
        if (rl1 < rl2) {
            return -1;
        } else if (rl1 > rl2) {
            return 1;
        }

        return v2.expression.localeCompare(v1.expression);
    });
}

function dictTermsUndupe(definitions) {
    const definitionGroups = {};
    for (const definition of definitions) {
        const definitionExisting = definitionGroups[definition.id];
        if (!definitionGroups.hasOwnProperty(definition.id) || definition.expression.length > definitionExisting.expression.length) {
            definitionGroups[definition.id] = definition;
        }
    }

    const definitionsUnique = [];
    for (const key in definitionGroups) {
        definitionsUnique.push(definitionGroups[key]);
    }

    return definitionsUnique;
}

function dictTermsGroup(definitions, dictionaries) {
    const groups = {};
    for (const definition of definitions) {
        const key = [definition.source, definition.expression].concat(definition.reasons);
        if (definition.reading) {
            key.push(definition.reading);
        }

        const group = groups[key];
        if (group) {
            group.push(definition);
        } else {
            groups[key] = [definition];
        }
    }

    const results = [];
    for (const key in groups) {
        const groupDefs = groups[key];
        const firstDef = groupDefs[0];
        dictTermsSort(groupDefs, dictionaries);
        results.push({
            definitions: groupDefs,
            expression: firstDef.expression,
            reading: firstDef.reading,
            reasons: firstDef.reasons,
            score: groupDefs.reduce((p, v) => v.score > p ? v.score : p, Number.MIN_SAFE_INTEGER),
            source: firstDef.source
        });
    }

    return dictTermsSort(results);
}

function dictTagBuildSource(name) {
    return dictTagSanitize({name, category: 'dictionary', order: 100});
}

function dictTagBuild(name, meta) {
    const tag = {name};
    const symbol = name.split(':')[0];
    for (const prop in meta[symbol] || {}) {
        tag[prop] = meta[symbol][prop];
    }

    return dictTagSanitize(tag);
}

function dictTagSanitize(tag) {
    tag.name = tag.name || 'untitled';
    tag.category = tag.category || 'default';
    tag.notes = tag.notes || '';
    tag.order = tag.order || 0;
    return tag;
}

function dictTagsSort(tags) {
    return tags.sort((v1, v2) => {
        const order1 = v1.order;
        const order2 = v2.order;
        if (order1 < order2) {
            return -1;
        } else if (order1 > order2) {
            return 1;
        }

        const name1 = v1.name;
        const name2 = v2.name;
        if (name1 < name2) {
            return -1;
        } else if (name1 > name2) {
            return 1;
        }

        return 0;
    });
}


function dictFieldSplit(field) {
    return field.length === 0 ? [] : field.split(' ');
}

function dictFieldFormat(field, definition, mode, options) {
    const markers = [
        'audio',
        'character',
        'cloze-body',
        'cloze-prefix',
        'cloze-suffix',
        'dictionary',
        'expression',
        'furigana',
        'glossary',
        'kunyomi',
        'onyomi',
        'reading',
        'sentence',
        'tags',
        'url'
    ];

    for (const marker of markers) {
        const data = {
            marker,
            definition,
            group: options.general.groupResults,
            html: options.anki.htmlCards,
            modeTermKanji: mode === 'term-kanji',
            modeTermKana: mode === 'term-kana',
            modeKanji: mode === 'kanji'
        };

        field = field.replace(
            `{${marker}}`,
            Handlebars.templates['fields.html'](data).trim()
        );
    }

    return field;
}


/*
 * Json/File
 */


function fileLoad(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.overrideMimeType('application/json');
        xhr.addEventListener('load', () => resolve(xhr.responseText));
        xhr.addEventListener('error', () => reject('failed to execute network request'));
        xhr.open('GET', url);
        xhr.send();
    }).then(responseText => {
        try {
            //return JSON.parse(responseText);
            return responseText;
        }
        catch (e) {
            return Promise.reject('invalid JSON response');
        }
    });
}

function jsonLoad(url) {
    return new Promise((resolve, reject) => {
        resolve(fileLoad(browser.extension.getURL(url)).then(json=> {return json}));
        reject('failed to execute network request');
    }).then(file => {return JSON.parse(file)});D
}


function readArray(name) {
    let a = this.read(name).split('\n');
    while ((a.length > 0) && (a[a.length - 1].length == 0)) a.pop();
    return a;
}

/*
 * Zip
 */

function zipLoadDb(archive, indexLoaded, termsLoaded, kanjiLoaded) {
    return JSZip.loadAsync(archive).then(files => files.files).then(files => {
        const indexFile = files['index.json'];
        if (!indexFile) {
            return Promise.reject('no dictionary index found in archive');
        }
		let index = {};
        indexFile.async('string').then(indexJson => {
            index = JSON.parse(indexJson);
            if (!index.title) {
                return Promise.reject('unrecognized dictionary format');
            }
            return index
        }).then(index =>{
            console.log(index);
            const dict = files['Dict.csv'];
            if (!dict) {
                return Promise.reject('missing Dictionary file');
            }
            const loaders = [];
            loaders.push(() => dict.async('string').then(dictCsv => {
                //const bank = JSON.parse(dictCsv);
                //console.log('rec' + bank.columns.length);
                const lines = dictCsv.split('>');
                let banksLoaded = 0;
                return termsLoaded(index.title, lines, 1, banksLoaded++);
            }));

            let chain = Promise.resolve();
            for (const loader of loaders) {
                chain = chain.then(loader);
            }
            return chain;
        });





       /*     return indexLoaded(
                index.title,
                index.version,
                index.revision,
                index.tagMeta || {},
                index.termBanks > 0,
                index.kanjiBanks > 0
            ).then(() => index);
        }).then(index => {
            const loaders = [];
            const banksTotal = index.termBanks + index.kanjiBanks;
            let banksLoaded = 0;

            for (let i = 1; i <= index.termBanks; ++i) {
                const bankFile = files[`term_bank_${i}.json`];
                if (!bankFile) {
                    return Promise.reject('missing term bank file');
                }

                loaders.push(() => bankFile.async('string').then(bankJson => {
                    const bank = JSON.parse(bankJson);
                    return termsLoaded(index.title, bank, banksTotal, banksLoaded++);
                }));
            }

            for (let i = 1; i <= index.kanjiBanks; ++i) {
                const bankFile = files[`kanji_bank_${i}.json`];
                if (!bankFile) {
                    return Promise.reject('missing kanji bank file');
                }

                loaders.push(() => bankFile.async('string').then(bankJson => {
                    const bank = JSON.parse(bankJson);
                    return kanjiLoaded(index.title, bank, banksTotal, banksLoaded++);
                }));
            }

            let chain = Promise.resolve();
            for (const loader of loaders) {
                chain = chain.then(loader);
            }

            return chain;
        });*/
    });
}




/*
 * Helpers
 */
/*
function handlebarsEscape(text) {
    return Handlebars.Utils.escapeExpression(text);
}

function handlebarsDumpObject(options) {
    const dump = JSON.stringify(options.fn(this), null, 4);
    return handlebarsEscape(dump);
}

function handlebarsKanjiLinks(options) {
    let result = '';
    for (const c of options.fn(this)) {
        if (jpIsKanji(c)) {
            result += `<a href="#" class="kanji-link">${c}</a>`;
        } else {
            result += c;
        }
    }

    return result;
}

function handlebarsMultiLine(options) {
    return options.fn(this).split('\n').join('<br>');
}

function handlebarsRegister() {
    Handlebars.partials = Handlebars.templates;
    Handlebars.registerHelper('dumpObject', handlebarsDumpObject);
    Handlebars.registerHelper('kanjiLinks', handlebarsKanjiLinks);
    Handlebars.registerHelper('multiLine', handlebarsMultiLine);
}

function handlebarsRender(template, data) {
    return Handlebars.templates[template](data);
}
*/