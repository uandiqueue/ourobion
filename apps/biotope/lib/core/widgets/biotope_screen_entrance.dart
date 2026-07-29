import 'package:flutter/material.dart';

import '../theme.dart';

/// Replays the reference screen entrance when [active] becomes true.
///
/// The child stays mounted while its tab is inactive, preserving each tab's
/// real loaded state; this is presentation-only and deliberately performs no
/// reloads or data work.
class BiotopeScreenEntrance extends StatefulWidget {
  final bool active;
  final Widget child;

  const BiotopeScreenEntrance({
    super.key,
    required this.active,
    required this.child,
  });

  @override
  State<BiotopeScreenEntrance> createState() => _BiotopeScreenEntranceState();
}

class _BiotopeScreenEntranceState extends State<BiotopeScreenEntrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: BiotopeMotion.screenEnter);
    if (widget.active) _controller.value = 1;
  }

  @override
  void didUpdateWidget(covariant BiotopeScreenEntrance oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.active && widget.active) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return widget.child;

    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        final progress = CurvedAnimation(
          parent: _controller,
          curve: BiotopeMotion.expressiveCurve,
        ).value;
        return Opacity(
          opacity: progress,
          child: Transform.translate(
            offset: Offset(0, (1 - progress) * BiotopeMotion.screenEnterOffset),
            child: child,
          ),
        );
      },
    );
  }
}
