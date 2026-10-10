# Arabic PDF spike verdict

Verdict: PASS

Shaping route: Fontkit joining. Logical text is passed to Fontkit. Arabic runs use script `arab` and direction `rtl`. After RTL layout, parentheses are L4-mirrored because Fontkit does not apply L4.

Font features: `rlig`, `liga`, `calt`, `ccmp`, `locl`, `mark`, `mkmk`, `kern`, `curs`, plus Fontkit's Arabic `init` / `medi` / `fina` / `isol`.

Sizes: title 14pt Noto Naskh Arabic Bold; sample body 11pt Noto Naskh Arabic Regular; English WinAnsi clusters stay Helvetica.

Letters join, wrapped lines continue the paragraph, the phone groups stay in order with the plus on the left, `-$50.00` keeps the minus on the left in the numeric column, and `شركة Acme (Egypt)` places the Arabic word to the right of the English name.
