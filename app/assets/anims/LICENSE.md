# Licence: our own animations (`Animations/Own/`)

Every clip in this folder was made by the ArtPipeline art session for the developer (Maksym Hrytsenko) from its own
key poses and formulas written in code (`Blender/own_anims.py`), on our own reference skeleton
(`Characters/Rigs/`, built by `Blender/ref_rigs.py`). No motion capture and no third-party animation is
read, copied, sampled or traced: not Mixamo, not Quaternius, not Meshy's clips, not any other library.
How each clip was made is recorded in `Base/Provenance/<clip>.json` (see `PROVENANCE.md`).

The developer owns these clips. They may be:
- used in any game or project, commercial or not;
- given to the users of WhiteWrite (whitewrite.com) and other services of the developer, as files or applied
  to the users' characters;
- changed, retargeted and redistributed by those users within their own projects.

Rule for anyone adding to this folder: only clips made here from our own poses. A clip that comes from, or was
matched frame by frame to, another library's animation does not belong here (it goes in `Animations/<Library>/`
under that library's licence). Describing a motion in words ("a slash with a slower wind-up") is fine; opening
someone else's clip beside ours and copying its poses is not.
