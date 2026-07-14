/// Centralized paths for AI-generated Biotope image assets.
///
/// Keep widget code importing these constants instead of hardcoding asset
/// strings. Only assets with an accepted status in the AI asset manifest should
/// be used in production UI.
abstract final class BiotopeGeneratedAssets {
  static const _base = 'assets/images/generated/biomech_botanical';

  static const homeHeroRobotHandMain =
      '$_base/home/home_hero_robot_hand_main.png';
  static const homeHeroRobotHandAlt01 =
      '$_base/home/home_hero_robot_hand_alt_01.png';
  static const homeFlowerClusterCard =
      '$_base/home/home_flower_cluster_card.png';

  static const scanBiomechOrchid = '$_base/scan/scan_biomech_orchid.png';
  static const scanCircularBloom = '$_base/scan/scan_circular_bloom.png';
  static const scanSensorFlowerCloseup =
      '$_base/scan/scan_sensor_flower_closeup.png';

  static const insightsNeuralBotanicalCluster =
      '$_base/insights/insights_neural_botanical_cluster.png';
  static const insightsBiomechHeartBloom =
      '$_base/insights/insights_biomech_heart_bloom.png';
  static const insightsBranchingNodeSystem =
      '$_base/insights/insights_branching_node_system.png';

  static const archiveHerbariumSpecimen =
      '$_base/archive/archive_herbarium_specimen.png';
  static const archivePreservedFlowerFragment =
      '$_base/archive/archive_preserved_flower_fragment.png';
  static const archiveReportThumbnailBase =
      '$_base/archive/archive_report_thumbnail_base.png';

  static const profileSignatureFlower =
      '$_base/profile/profile_signature_flower.png';
  static const profilePorcelainCamellia =
      '$_base/profile/profile_porcelain_camellia.png';
  static const profileBotanicalCrest =
      '$_base/profile/profile_botanical_crest.png';

  static const decoVineCornerLeft =
      '$_base/decorative/deco_vine_corner_left.png';
  static const decoVineCornerRight =
      '$_base/decorative/deco_vine_corner_right.png';
  static const decoFlowerClusterWhite =
      '$_base/decorative/deco_flower_cluster_white.png';
  static const decoFlowerClusterBlush =
      '$_base/decorative/deco_flower_cluster_blush.png';
  static const decoSmallBiomechBloom =
      '$_base/decorative/deco_small_biomech_bloom.png';
  static const decoLeafBrassNode =
      '$_base/decorative/deco_leaf_brass_node.png';

  static const emptyScanBloom =
      '$_base/empty_states/empty_scan_bloom.png';
  static const emptyArchiveSpecimen =
      '$_base/empty_states/empty_archive_specimen.png';
  static const emptyInsightsSeedpod =
      '$_base/empty_states/empty_insights_seedpod.png';
  static const emptyNotificationsFlower =
      '$_base/empty_states/empty_notifications_flower.png';
}
