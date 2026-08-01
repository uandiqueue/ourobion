import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:ourobion_metrics/ourobion_metrics.dart';

import '../../../../core/theme.dart';

/// User-facing copy for the registry-bounded count affordance.
abstract final class QuickCountCopy {
  static const other = 'Other...';
  static const useValue = 'Use value';
  static const clear = 'Clear';

  static String customLabel(String metricLabel) =>
      'Custom ${metricLabel.toLowerCase()}';

  static String helper(int min, int max) =>
      'Enter a whole number from $min to $max.';

  static String quickOption(String metricLabel, int value) =>
      '$metricLabel $value';

  static String selectedQuickOption(String metricLabel, int value) =>
      '$metricLabel $value selected. Tap to clear.';

  static String customOption(String metricLabel) =>
      'Enter another $metricLabel value';

  static const allStatic = [other, useValue, clear];
}

/// One count input pattern for the common 0-3 range and the bounded tail.
///
/// [metricKey] must name a registry metric whose ui.inputType is quick_count,
/// whose scale endpoints are whole numbers, and whose value increment is one.
/// The custom path reads those bounds from the registry and calls [onChanged]
/// only after validation, so it cannot bypass the same contract that drives
/// the trend axis.
class QuickCountControl extends StatefulWidget {
  final String metricKey;
  final int? value;
  final bool enabled;
  final bool allowClear;
  final ValueChanged<int?> onChanged;

  const QuickCountControl({
    super.key,
    required this.metricKey,
    required this.value,
    required this.onChanged,
    this.enabled = true,
    this.allowClear = false,
  });

  @override
  State<QuickCountControl> createState() => _QuickCountControlState();
}

class _QuickCountControlState extends State<QuickCountControl> {
  static const _commonMax = 3;

  late final TextEditingController _controller;
  late final FocusNode _focusNode;
  late bool _showCustom;
  String? _errorText;

  MetricDefinition get _metric {
    final metric = metricByKey(widget.metricKey);
    final scale = metric?.scale;
    if (metric == null ||
        metric.ui?.inputType != 'quick_count' ||
        scale == null ||
        metric.valueStep != 1 ||
        scale.min != scale.min.roundToDouble() ||
        scale.max != scale.max.roundToDouble()) {
      throw StateError(
        '${widget.metricKey} must declare a whole-step quick_count scale',
      );
    }
    return metric;
  }

  int get _min => _metric.scale!.min.toInt();
  int get _max => _metric.scale!.max.toInt();
  String get _label => _metric.ui!.label;

  bool _isCustomValue(int? value) =>
      value != null && (value < _min || value > _commonMax);

  @override
  void initState() {
    super.initState();
    _showCustom = _isCustomValue(widget.value);
    _controller = TextEditingController(
      text: _showCustom ? widget.value.toString() : '',
    );
    _focusNode = FocusNode();
  }

  @override
  void didUpdateWidget(covariant QuickCountControl oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.metricKey != widget.metricKey ||
        oldWidget.value != widget.value) {
      final custom = _isCustomValue(widget.value);
      _showCustom = custom;
      _errorText = null;
      _controller.text = custom ? widget.value.toString() : '';
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _chooseQuick(int value) {
    if (!widget.enabled) return;
    _focusNode.unfocus();
    setState(() {
      _showCustom = false;
      _errorText = null;
      _controller.clear();
    });
    final clear = widget.allowClear && widget.value == value;
    widget.onChanged(clear ? null : value);
  }

  void _openCustom() {
    if (!widget.enabled) return;
    setState(() {
      _showCustom = true;
      _errorText = null;
      if (!_isCustomValue(widget.value)) _controller.clear();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  void _commitCustom() {
    if (!widget.enabled) return;
    final value = int.tryParse(_controller.text.trim());
    if (value == null || value < _min || value > _max) {
      setState(() => _errorText = QuickCountCopy.helper(_min, _max));
      return;
    }
    setState(() => _errorText = null);
    widget.onChanged(value);
  }

  void _clear() {
    if (!widget.enabled || !widget.allowClear) return;
    _focusNode.unfocus();
    setState(() {
      _showCustom = false;
      _errorText = null;
      _controller.clear();
    });
    widget.onChanged(null);
  }

  @override
  Widget build(BuildContext context) {
    final quickValues = [
      for (var value = _min; value <= _commonMax && value <= _max; value++)
        value,
    ];
    final customSelected = _isCustomValue(widget.value);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 7,
          runSpacing: 7,
          children: [
            for (final value in quickValues)
              Semantics(
                button: true,
                enabled: widget.enabled,
                selected: widget.value == value,
                label: widget.allowClear && widget.value == value
                    ? QuickCountCopy.selectedQuickOption(_label, value)
                    : QuickCountCopy.quickOption(_label, value),
                onTap: widget.enabled ? () => _chooseQuick(value) : null,
                child: ExcludeSemantics(
                  child: SizedBox(
                    height: 48,
                    child: ChoiceChip(
                      key: ValueKey('quick-count-${widget.metricKey}-$value'),
                      label: Text('$value'),
                      selected: widget.value == value,
                      onSelected: widget.enabled
                          ? (_) => _chooseQuick(value)
                          : null,
                      labelStyle: GoogleFonts.manrope(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: widget.value == value
                            ? OurobionColors.onPrimary
                            : OurobionColors.onSurfaceVariant,
                      ),
                      selectedColor: OurobionColors.primary,
                      backgroundColor: OurobionColors.surfaceContainer,
                      side: BorderSide(
                        color: OurobionColors.primary.withValues(alpha: 0.35),
                      ),
                      showCheckmark: false,
                    ),
                  ),
                ),
              ),
            Semantics(
              button: true,
              enabled: widget.enabled,
              selected: customSelected || _showCustom,
              label: QuickCountCopy.customOption(_label),
              onTap: widget.enabled ? _openCustom : null,
              child: ExcludeSemantics(
                child: SizedBox(
                  height: 48,
                  child: ChoiceChip(
                    key: ValueKey('quick-count-${widget.metricKey}-other'),
                    label: const Text(QuickCountCopy.other),
                    selected: customSelected || _showCustom,
                    onSelected: widget.enabled ? (_) => _openCustom() : null,
                    labelStyle: GoogleFonts.manrope(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: customSelected || _showCustom
                          ? OurobionColors.onPrimary
                          : OurobionColors.onSurfaceVariant,
                    ),
                    selectedColor: OurobionColors.primary,
                    backgroundColor: OurobionColors.surfaceContainer,
                    side: BorderSide(
                      color: OurobionColors.primary.withValues(alpha: 0.35),
                    ),
                    showCheckmark: false,
                  ),
                ),
              ),
            ),
          ],
        ),
        if (_showCustom) ...[
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextField(
                  key: ValueKey('quick-count-${widget.metricKey}-field'),
                  controller: _controller,
                  focusNode: _focusNode,
                  enabled: widget.enabled,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.done,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  onSubmitted: (_) => _commitCustom(),
                  style: GoogleFonts.manrope(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: InputDecoration(
                    labelText: QuickCountCopy.customLabel(_label),
                    helperText: QuickCountCopy.helper(_min, _max),
                    errorText: _errorText,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 48,
                child: FilledButton(
                  key: ValueKey('quick-count-${widget.metricKey}-apply'),
                  onPressed: widget.enabled ? _commitCustom : null,
                  child: const Text(QuickCountCopy.useValue),
                ),
              ),
            ],
          ),
        ],
        if (widget.allowClear && widget.value != null) ...[
          const SizedBox(height: 4),
          TextButton(
            key: ValueKey('quick-count-${widget.metricKey}-clear'),
            onPressed: widget.enabled ? _clear : null,
            child: const Text(QuickCountCopy.clear),
          ),
        ],
      ],
    );
  }
}
