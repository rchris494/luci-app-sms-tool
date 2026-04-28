'use strict';
'require view';
'require form';
'require rpc';

var callModemInfo = rpc.declare({ object: 'luci.sms-tool', method: 'modem_info' });

return view.extend({
	title: _('Settings'),
	order: 50,

	render: function() {
		var m, s, o;

		m = new form.Map('sms-tool', _('SMS Tool'),
			_('Configure modem ports, storage and polling options.'));

		s = m.section(form.NamedSection, 'global', 'sms-tool', _('General'));
		s.addremove = false;
		o = s.option(form.Flag,  'enabled', _('Enable SMS Tool'));
		o.default  = '1';
		o.rmempty  = false;

		s = m.section(form.NamedSection, 'global', 'sms-tool', _('Port Configuration'));
		s.addremove = false;

		var ports = [];
		for (var i = 0; i <= 7; i++) ports.push('/dev/ttyUSB' + i);

		o = s.option(form.ListValue, 'modem_port', _('Modem Control Port'));
		ports.forEach(function(p) { o.value(p, p); });
		o.default     = '/dev/ttyUSB2';
		o.description = _('Primary AT command port');
		o.rmempty     = false;

		o = s.option(form.ListValue, 'receive_port', _('Receive Port'));
		ports.forEach(function(p) { o.value(p, p); });
		o.default     = '/dev/ttyUSB2';
		o.description = _('Serial port for receiving SMS');
		o.rmempty     = false;

		o = s.option(form.ListValue, 'send_port', _('Send Port'));
		ports.forEach(function(p) { o.value(p, p); });
		o.default     = '/dev/ttyUSB2';
		o.description = _('Serial port used for sending SMS');
		o.rmempty     = false;

		o = s.option(form.ListValue, 'baud_rate', _('Baud Rate'));
		['9600','19200','38400','57600','115200','230400','460800'].forEach(function(r) { o.value(r, r); });
		o.default  = '115200';
		o.rmempty  = false;

		s = m.section(form.NamedSection, 'global', 'sms-tool', _('SIM / Storage'));
		s.addremove = false;

		o = s.option(form.ListValue, 'storage', _('Default Message Storage'));
		o.value('SM', 'SM – ' + _('SIM card'));
		o.value('ME', 'ME – ' + _('Modem/device memory'));
		o.value('MT', 'MT – ' + _('Both (preferred)'));
		o.default     = 'ME';
		o.description = _('SM = SIM card · ME = Modem memory · MT = Modem preferred');

		o = s.option(form.Value, 'pin', _('SIM PIN'));
		o.password    = true;
		o.description = _('Leave blank if SIM has no PIN');
		o.rmempty     = true;

		o = s.option(form.Value, 'max_messages', _('Max Stored Messages'));
		o.datatype    = 'range(10,5000)';
		o.default     = '500';

		s = m.section(form.NamedSection, 'global', 'sms-tool', _('Polling'));
		s.addremove = false;

		o = s.option(form.Value, 'poll_interval', _('Poll Interval (seconds)'));
		o.datatype    = 'range(5,3600)';
		o.default     = '30';

		o = s.option(form.Flag, 'delete_after_read', _('Delete from Modem After Read'));
		o.description = _('Automatically remove messages from modem storage after they are fetched');
		o.default     = '0';

		return m.render().then(function(mapEl) {
			var testResult = E('div', { class: 'alert-message', style: 'display:none;margin-top:1em;' });
			var testBtn    = E('button', { class: 'btn cbi-button', style: 'margin-top:1em;' }, _('Test Modem Connection'));

			testBtn.addEventListener('click', function() {
				testResult.className   = 'alert-message';
				testResult.textContent = _('Testing modem connection...');
				testResult.style.display = 'block';

				callModemInfo().then(function(d) {
					d = d || {};
					if (d.error) {
						testResult.className   = 'alert-message warning';
						testResult.textContent = _('Error: ') + d.error;
					} else {
						testResult.className   = 'alert-message success';
						testResult.textContent = _('Connected – ') + (d.manufacturer || '?') + ' ' + (d.model || '') +
							' · IMEI: ' + (d.imei || '?') +
							' · Signal: ' + (d.signal_dbm || '?') + ' dBm' +
							' · Network: ' + (d.network || '?');
					}
				}).catch(function(e) {
					testResult.className   = 'alert-message danger';
					testResult.textContent = _('Connection test failed: ') + e.message;
				});
			});

			return E('div', {}, [ mapEl, testBtn, testResult ]);
		});
	}
});
