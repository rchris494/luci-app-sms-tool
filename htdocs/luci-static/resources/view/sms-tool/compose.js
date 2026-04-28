'use strict';
'require view';
'require rpc';
'require ui';

var callSend      = rpc.declare({ object: 'luci.sms-tool', method: 'send',       params: ['number', 'message'] });
var callModemInfo = rpc.declare({ object: 'luci.sms-tool', method: 'modem_info'  });

return view.extend({
	title: _('Compose'),
	order: 20,

	load: function() {
		return callModemInfo();
	},

	render: function(modem) {
		modem = modem || {};

		var params     = new URLSearchParams(window.location.search);
		var prefillTo  = params.get('to')   || '';
		var prefillBody= params.get('body')  || '';

		var statusEl = E('div', { class: 'alert-message', style: 'display:none;margin-bottom:1em;' });

		var toInput = E('input', {
			type: 'tel', class: 'cbi-input-text',
			placeholder: '+1234567890', style: 'max-width:280px;',
			value: prefillTo
		});

		var counterEl = E('span', { style: 'font-size:.8em;color:#666;' }, '0 / 160');
		var bodyEl = E('textarea', {
			class: 'cbi-input-textarea', rows: '5', maxlength: '918',
			placeholder: _('Type your message here…'),
			style: 'width:100%;max-width:520px;resize:vertical;'
		}, prefillBody);

		function updateCounter() {
			var len   = bodyEl.value.length;
			var limit = len <= 160 ? 160 : len <= 306 ? 306 : Math.ceil(len / 153) * 153;
			counterEl.textContent = len + ' / ' + limit;
			counterEl.style.color = len > 160 ? '#e67e22' : '#666';
			if (len > 306) counterEl.style.color = '#c0392b';
		}
		bodyEl.addEventListener('input', updateCounter);
		updateCounter();

		var sendBtn  = E('button', { class: 'btn cbi-button cbi-button-action' }, '✉ ' + _('Send SMS'));
		var draftBtn = E('button', { class: 'btn cbi-button' }, _('Save as Draft'));
		var clearBtn = E('button', { class: 'btn cbi-button' }, _('Clear'));

		sendBtn.addEventListener('click', function() {
			var number  = toInput.value.trim();
			var message = bodyEl.value.trim();
			if (!number)  { ui.addNotification(null, E('p', _('Please enter a phone number.')),  'error'); return; }
			if (!message) { ui.addNotification(null, E('p', _('Please enter a message.')), 'error'); return; }

			sendBtn.disabled    = true;
			sendBtn.textContent = _('Sending…');
			statusEl.style.display = 'none';

			callSend(number, message).then(function(d) {
				statusEl.style.display = 'block';
				if (d && d.success) {
					statusEl.className   = 'alert-message success';
					statusEl.textContent = _('Message sent successfully. Reference: ') + (d.mr || '—');
					var sent = JSON.parse(localStorage.getItem('sms_sent') || '[]');
					sent.push({ number: number, body: message, ts: new Date().toISOString(), mr: d.mr || '' });
					localStorage.setItem('sms_sent', JSON.stringify(sent));
					bodyEl.value = '';
					updateCounter();
				} else {
					statusEl.className   = 'alert-message warning';
					statusEl.textContent = _('Send failed: ') + ((d && d.error) || _('unknown error'));
				}
			}).catch(function(e) {
				statusEl.style.display = 'block';
				statusEl.className     = 'alert-message danger';
				statusEl.textContent   = _('Network error: ') + e.message;
			}).finally(function() {
				sendBtn.disabled    = false;
				sendBtn.textContent = '✉ ' + _('Send SMS');
			});
		});

		draftBtn.addEventListener('click', function() {
			var drafts = JSON.parse(localStorage.getItem('sms_drafts') || '[]');
			drafts.push({ number: toInput.value, body: bodyEl.value, saved: new Date().toISOString() });
			localStorage.setItem('sms_drafts', JSON.stringify(drafts));
			statusEl.style.display = 'block';
			statusEl.className     = 'alert-message notice';
			statusEl.textContent   = _('Draft saved locally.');
		});

		clearBtn.addEventListener('click', function() {
			toInput.value = ''; bodyEl.value = '';
			updateCounter();
			statusEl.style.display = 'none';
		});

		var modemTable = E('table', { class: 'table', style: 'width:auto;' }, [
			E('tr', {}, [ E('th', { class: 'th', style: 'width:160px;' }, _('Manufacturer')), E('td', { class: 'td' }, modem.manufacturer || '—') ]),
			E('tr', {}, [ E('th', { class: 'th' }, _('Model')),      E('td', { class: 'td' }, modem.model      || '—') ]),
			E('tr', {}, [ E('th', { class: 'th' }, _('IMEI')),       E('td', { class: 'td' }, modem.imei       || '—') ]),
			E('tr', {}, [ E('th', { class: 'th' }, _('Network')),    E('td', { class: 'td' }, modem.network    || '—') ]),
			E('tr', {}, [ E('th', { class: 'th' }, _('Signal')),     E('td', { class: 'td' }, modem.signal_dbm ? modem.signal_dbm + ' dBm (raw: ' + modem.signal_raw + ')' : '—') ]),
			E('tr', {}, [ E('th', { class: 'th' }, _('SIM Status')), E('td', { class: 'td' }, modem.sim_status || '—') ])
		]);

		return E('div', {}, [
			statusEl,
			E('div', { class: 'cbi-map' }, [
				E('div', { class: 'cbi-section' }, [
					E('div', { class: 'cbi-section-node' }, [
						E('div', { class: 'cbi-value' }, [
							E('label', { class: 'cbi-value-title' }, _('To')),
							E('div',   { class: 'cbi-value-field' }, [
								toInput,
								E('div', { class: 'cbi-value-description' }, _('International format recommended, e.g. +44771234567'))
							])
						]),
						E('div', { class: 'cbi-value' }, [
							E('label', { class: 'cbi-value-title' }, _('Message')),
							E('div',   { class: 'cbi-value-field' }, [
								bodyEl,
								E('div', { style: 'display:flex;justify-content:space-between;max-width:520px;' }, [
									E('span', { class: 'cbi-value-description' }, _('Max 918 characters (6 concatenated SMS)')),
									counterEl
								])
							])
						]),
						E('div', { class: 'cbi-value' }, [
							E('div', { class: 'cbi-value-field', style: 'display:flex;gap:8px;flex-wrap:wrap;' },
								[ sendBtn, draftBtn, clearBtn ])
						])
					])
				])
			]),
			E('div', { class: 'cbi-map', style: 'margin-top:1em;' }, [
				E('div', { class: 'cbi-section' }, [
					E('legend', {}, _('Modem Status')),
					E('div', { class: 'cbi-section-node' }, [ modemTable ])
				])
			])
		]);
	},

	handleSave:      null,
	handleSaveApply: null,
	handleReset:     null
});
