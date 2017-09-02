/*
 * Copyright (C) 2017  Alex Yatskov <alex@foosoft.net>
 * Author: Alex Yatskov <alex@foosoft.net>
 *
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


/*$(document).ready(() => {
    $('#open-search').click(() => commandExec('search'));
    $('#open-options').click(() => commandExec('options'));
    $('#open-help').click(() => commandExec('help'));

    optionsLoad().then(options => {
        const toggle = $('#enable-search');
        toggle.prop('checked', options.general.enable).change();
        toggle.bootstrapToggle();
        toggle.change(() => commandExec('toggle'));
    });
});
*/

// browser.extension.getBackgroundPage().rikaichanWebEx.processMessage()

let state = false;
function rikaiToggle(){
	state = !state;
	if (state){
		document.getElementById('open').innerText = 'Off';	
		browser.extension.getBackgroundPage().rikaichanWebEx.processMessage();
	}else{
		document.getElementById('open').innerText = 'On';
		browser.extension.getBackgroundPage().rikaichanWebEx.processMessage();
	}
	
}


document.getElementById('open').onclick = rikaiToggle;