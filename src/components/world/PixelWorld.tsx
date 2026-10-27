'use client'

import { useState } from 'react'

/**
 * "Your World" as blocky, Minecraft-style pixel art. One 10-unit block grid (viewBox 320x180 = 32x18 blocks).
 * Stages: 0 Seed → 1 Small plant → 2 Farm (+scarecrow) → 3 Caretaker & Barn (+farmer) → 4 Thriving world.
 * Counts (crops, fruit trees, blooms, care station) come from the member's verified deeds.
 */
export interface WorldProps {
  stage: number          // 0..4
  growth: number         // 0..1 progress inside the current stage
  crops: number          // wheat plants (from volunteer hours)
  fruitTrees: number     // from invited friends
  flowers: number        // from events taken part in
  careStation: boolean   // from a verified blood donation
  night: boolean
  onInspect: (info: { title: string; text: string } | null) => void
}

const Specks = ({ s }: { s: [number, number, number, number, string][] }) => (
  <>{s.map(([x, y, w, h, c], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={c} />)}</>
)

function Patterns() {
  return (
    <defs>
      <pattern id="px-grass" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#866043" />
        <Specks s={[[2,5,2,2,'#6f4e37'],[7,7,2,1,'#6f4e37'],[5,4,1,1,'#9b7352'],[1,8,1,1,'#9b7352']]} />
        <rect width="10" height="3" fill="#5fa03e" />
        <Specks s={[[1,0,2,1,'#79b84f'],[6,1,2,1,'#79b84f'],[0,2,3,1,'#4b8a31'],[5,2,2,1,'#4b8a31'],[2,3,1,1,'#5fa03e'],[7,3,1,2,'#5fa03e'],[9,0,1,10,'rgba(0,0,0,.1)'],[0,9,10,1,'rgba(0,0,0,.1)']]} />
      </pattern>
      <pattern id="px-dirt" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#866043" />
        <Specks s={[[2,2,2,2,'#6f4e37'],[7,6,2,1,'#6f4e37'],[4,8,2,1,'#6f4e37'],[6,1,1,1,'#9b7352'],[1,6,1,1,'#9b7352'],[8,3,1,1,'#9b7352'],[9,0,1,10,'rgba(0,0,0,.1)'],[0,9,10,1,'rgba(0,0,0,.1)']]} />
      </pattern>
      <pattern id="px-stone" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#7d7d7d" />
        <Specks s={[[1,1,3,2,'#6b6b6b'],[6,5,3,2,'#6b6b6b'],[5,1,2,1,'#929292'],[1,7,2,1,'#929292'],[9,0,1,10,'rgba(0,0,0,.15)'],[0,9,10,1,'rgba(0,0,0,.15)']]} />
      </pattern>
      <pattern id="px-coal" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#7d7d7d" />
        <Specks s={[[1,2,3,3,'#262626'],[6,1,2,2,'#262626'],[5,6,3,3,'#262626'],[2,7,2,2,'#262626'],[9,0,1,10,'rgba(0,0,0,.15)'],[0,9,10,1,'rgba(0,0,0,.15)']]} />
      </pattern>
      <pattern id="px-diamond" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#7d7d7d" />
        <Specks s={[[1,2,3,3,'#4ee6d6'],[6,1,2,2,'#4ee6d6'],[5,6,3,3,'#4ee6d6'],[2,2,1,1,'#c9fff8'],[6,6,1,1,'#c9fff8'],[9,0,1,10,'rgba(0,0,0,.15)'],[0,9,10,1,'rgba(0,0,0,.15)']]} />
      </pattern>
      <pattern id="px-farm" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#70492b" />
        <rect width="10" height="3" fill="#4a2f1b" />
        <Specks s={[[1,1,3,1,'#3b2314'],[6,1,3,1,'#3b2314'],[2,5,2,2,'#5d3a22'],[7,7,2,1,'#5d3a22'],[9,0,1,10,'rgba(0,0,0,.1)'],[0,9,10,1,'rgba(0,0,0,.1)']]} />
      </pattern>
      <pattern id="px-water" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#3f76e4" />
        <Specks s={[[1,2,3,1,'#6f9bf2'],[6,6,3,1,'#6f9bf2'],[3,8,2,1,'#2f5fc7'],[7,3,2,1,'#2f5fc7']]} />
      </pattern>
      <pattern id="px-planks" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#b8945f" />
        <Specks s={[[0,4,10,1,'#9a7a49'],[0,9,10,1,'#9a7a49'],[2,2,1,1,'#7d6038'],[7,7,1,1,'#7d6038']]} />
      </pattern>
      <pattern id="px-log" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#6b4f2a" />
        <Specks s={[[2,0,1,10,'#4f3a1e'],[6,0,1,10,'#4f3a1e'],[8,0,1,10,'#4f3a1e'],[4,0,1,10,'#7d5f35']]} />
      </pattern>
      <pattern id="px-leaves" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#3f7f2c" />
        <Specks s={[[1,1,2,2,'#2f6a20'],[6,3,2,2,'#2f6a20'],[3,7,3,2,'#2f6a20'],[7,7,2,1,'#55a03a'],[2,4,1,1,'#55a03a'],[8,0,1,1,'#55a03a']]} />
      </pattern>
      <pattern id="px-barn" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#a83232" />
        <Specks s={[[0,3,10,1,'#8c2626'],[0,6,10,1,'#8c2626'],[0,9,10,1,'#8c2626'],[4,0,1,10,'#b94040']]} />
      </pattern>
      <pattern id="px-roof" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#6e2424" />
        <Specks s={[[0,4,10,1,'#581b1b'],[0,9,10,1,'#581b1b'],[5,0,1,5,'#581b1b'],[2,5,1,5,'#581b1b']]} />
      </pattern>
      <pattern id="px-hay" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#d9b73a" />
        <Specks s={[[0,2,10,1,'#b8962a'],[0,5,10,1,'#b8962a'],[0,8,10,1,'#b8962a'],[3,0,1,10,'#7c5a1f'],[7,0,1,10,'#7c5a1f']]} />
      </pattern>
    </defs>
  )
}

const FLOWER_COLORS = ['#e04a4a', '#f0c030', '#4a7be0', '#e07ac0', '#ffffff']
const FLOWER_SLOTS = [84, 90, 52, 226, 232, 236, 56, 94]
const FRUIT_SLOTS = [116, 162, 206]
const FARM_X = 100, FARM_BLOCKS = 12, WATER_AT = [3, 8], SCARECROW_AT = 5

function Wheat({ x, ripe, h }: { x: number; ripe: number; h: number }) {
  const head = ripe === 0 ? '#8fc653' : ripe === 1 ? '#c8c24a' : '#e3bd3d'
  const stem = ripe === 0 ? '#5fa03e' : ripe === 1 ? '#8aa83c' : '#b9a23a'
  return (
    <g>
      {[1, 4, 7].map((o, i) => {
        const hh = h - (i === 1 ? 0 : 2)
        return (
          <g key={o}>
            <rect x={x + o} y={120 - hh} width={2} height={hh} fill={stem} />
            <rect x={x + o - 1} y={120 - hh - 3} width={4} height={4} fill={head} />
            <rect x={x + o} y={120 - hh - 3} width={1} height={2} fill="rgba(255,255,255,.35)" />
          </g>
        )
      })}
    </g>
  )
}

function Tree({ x, fruit }: { x: number; fruit: boolean }) {
  return (
    <g>
      <rect x={x} y={90} width={10} height={30} fill="url(#px-log)" />
      <rect x={x} y={60} width={10} height={10} fill="url(#px-leaves)" />
      <rect x={x - 10} y={70} width={30} height={10} fill="url(#px-leaves)" />
      <rect x={x - 10} y={80} width={30} height={10} fill="url(#px-leaves)" />
      {fruit && [[x - 6, 74], [x + 12, 76], [x + 2, 84], [x + 14, 85], [x - 4, 85]].map(([ax, ay], i) => (
        <g key={i}><rect x={ax} y={ay} width={3} height={3} fill="#d83a34" /><rect x={ax} y={ay} width={1} height={1} fill="#ff8a80" /></g>
      ))}
    </g>
  )
}

function Cloud({ y, cls }: { y: number; cls: string }) {
  return (
    <g className={`mc-cloud ${cls}`}>
      <g transform={`translate(0 ${y})`} fill="#fff" opacity=".95">
        <rect x="20" y="0" width="20" height="10" /><rect x="10" y="10" width="50" height="10" /><rect x="0" y="20" width="70" height="10" />
        <rect x="10" y="30" width="50" height="0" />
      </g>
    </g>
  )
}

export function PixelWorld({ stage, growth, crops, fruitTrees, flowers, careStation, night, onInspect }: WorldProps) {
  const [bursts, setBursts] = useState<{ k: number; x: number }[]>([])

  const hot = (title: string, text: string) => ({
    className: 'mc-hot', tabIndex: 0, role: 'button' as const, 'aria-label': `${title}. ${text}`,
    onClick: () => onInspect({ title, text }),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInspect({ title, text }) } },
  })
  const harvest = (x: number) => {
    const k = Date.now() + x
    setBursts((b) => [...b, { k, x }])
    setTimeout(() => setBursts((b) => b.filter((i) => i.k !== k)), 900)
    onInspect({ title: 'Wheat field', text: `${crops} crops are growing. Every volunteer hour you give waters the field.` })
  }

  const sky = night ? ['#0b1030', '#101842', '#18215a', '#222c72'] : ['#6fb6ea', '#86c4f0', '#9dd1f5', '#b5e0f9']
  const mountain = night ? '#2a3566' : '#7f9db8'
  const cropSlots = Array.from({ length: FARM_BLOCKS }, (_, i) => i).filter((i) => !WATER_AT.includes(i) && i !== SCARECROW_AT)
  // fill from the middle outwards so a small count still looks intentional
  const ordered = [...cropSlots].sort((a, b) => Math.abs(a - 5.5) - Math.abs(b - 5.5))
  const planted = new Set(ordered.slice(0, Math.min(crops, ordered.length)))
  const cropH = 7 + Math.round(growth * 4)
  const sproutScale = 0.7 + 0.3 * growth

  return (
    <svg viewBox="0 20 320 140" className="mc-scene" shapeRendering="crispEdges" role="group"
      aria-label={`Your world, stage ${stage + 1} of 5`} xmlns="http://www.w3.org/2000/svg">
      <Patterns />

      {/* sky */}
      {sky.map((c, i) => <rect key={i} x="0" y={i * 30} width="320" height="30" fill={c} />)}
      {night
        ? <g>{[[20,14],[60,34],[110,10],[150,28],[200,16],[240,40],[290,12],[300,50],[40,60],[180,52]].map(([x, y], i) => <rect key={i} className="mc-twinkle" style={{ animationDelay: `${i * 0.37}s` }} x={x} y={y} width="2" height="2" fill="#fff" />)}
            <g><rect x="206" y="30" width="24" height="24" fill="#e8ecf5" /><rect x="212" y="36" width="6" height="6" fill="#c9cfdd" /><rect x="220" y="44" width="5" height="5" fill="#c9cfdd" /></g></g>
        : <g><rect x="204" y="26" width="30" height="30" fill="#ffd23f" /><rect x="209" y="31" width="20" height="20" fill="#fff1a8" /></g>}
      {!night && <><Cloud y={26} cls="c1" /><Cloud y={52} cls="c2" /><Cloud y={36} cls="c3" /></>}

      {/* far blocky mountains */}
      {[20, 30, 40, 30, 20, 30, 50, 60, 50, 30, 20, 30, 40, 30, 20, 20].map((h, i) => (
        <rect key={i} x={i * 20} y={120 - h} width="20" height={h} fill={mountain} opacity=".85" />
      ))}
      {[[140, 60, 20], [120, 70, 20], [160, 70, 20]].map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height="5" fill={night ? '#cfd6ee' : '#f2f6fb'} opacity=".95" />)}

      {/* left hill */}
      <rect x="0" y="110" width="40" height="10" fill="url(#px-grass)" />
      <rect x="0" y="100" width="20" height="10" fill="url(#px-grass)" />

      {/* stage 4: windmill + oaks + fruit trees stand behind the ground line */}
      {stage >= 4 && (
        <g>
          <g {...hot('Windmill', 'Thriving worlds run on community energy.')}>
            <rect x="21" y="84" width="12" height="26" fill="url(#px-planks)" />
            <rect x="22" y="76" width="10" height="8" fill="url(#px-planks)" />
            <rect x="20" y="72" width="14" height="4" fill="url(#px-roof)" />
            <rect x="25" y="98" width="4" height="12" fill="#5a3a22" />
            <g className="mc-spin" style={{ transformOrigin: '27px 78px' }}>
              <rect x="26" y="62" width="2" height="32" fill="#8a6a3a" /><rect x="11" y="77" width="32" height="2" fill="#8a6a3a" />
              <rect x="28" y="62" width="6" height="12" fill="#eee6d2" /><rect x="20" y="82" width="6" height="12" fill="#eee6d2" />
              <rect x="35" y="79" width="8" height="6" fill="#eee6d2" /><rect x="11" y="71" width="8" height="6" fill="#eee6d2" />
              <rect x="25" y="76" width="4" height="4" fill="#5a3a22" />
            </g>
          </g>
          <g {...hot('Oak tree', 'Tall oaks only grow in a thriving world.')}><Tree x={44} fruit={false} /></g>
        </g>
      )}
      {stage >= 3 && FRUIT_SLOTS.slice(0, Math.min(fruitTrees, 3)).map((x) => (
        <g key={x} {...hot('Fruit tree', `${fruitTrees} fruit ${fruitTrees === 1 ? 'tree' : 'trees'} are growing. Every friend you invite plants one.`)}><Tree x={x} fruit /></g>
      ))}

      {/* ground */}
      <rect x="0" y="120" width="320" height="10" fill="url(#px-grass)" />
      <rect x="0" y="120" width="40" height="10" fill="url(#px-dirt)" />
      <rect x="0" y="130" width="320" height="20" fill="url(#px-dirt)" />
      <rect x="0" y="150" width="320" height="10" fill="url(#px-stone)" />
      <rect x="40" y="130" width="10" height="10" fill="url(#px-coal)" />
      <rect x="200" y="140" width="10" height="10" fill="url(#px-coal)" />
      <rect x="270" y="130" width="10" height="10" fill="url(#px-coal)" />
      <rect x="150" y="150" width="10" height="10" fill="url(#px-diamond)" />
      {[48, 54, 90, 96, 238, 246].map((x) => <g key={x} fill="#4b8a31"><rect x={x} y="117" width="1" height="3" /><rect x={x + 2} y="116" width="1" height="4" /></g>)}

      {/* stage 4: pond, blooms, chickens */}
      {stage >= 4 && (
        <g>
          <g {...hot('Pond', 'A calm spot that appears once your world thrives.')}>
            <rect x="60" y="120" width="20" height="20" fill="url(#px-water)" />
            <rect x="66" y="119" width="6" height="2" fill="#4c9a3a" /><rect x="68" y="118" width="2" height="2" fill="#ffffff" />
            <rect className="mc-twinkle" x="63" y="123" width="2" height="1" fill="#fff" /><rect className="mc-twinkle" style={{ animationDelay: '.8s' }} x="73" y="127" width="2" height="1" fill="#fff" />
          </g>
          {FLOWER_SLOTS.slice(0, Math.min(flowers, FLOWER_SLOTS.length)).map((x, i) => (
            <g key={x} {...hot('Bloom', `${flowers} ${flowers === 1 ? 'bloom has' : 'blooms have'} opened. Every event you take part in opens one.`)}>
              <rect x={x + 1} y="116" width="1" height="4" fill="#3f8a2b" />
              <rect x={x} y="113" width="3" height="3" fill={FLOWER_COLORS[i % FLOWER_COLORS.length]} />
              <rect x={x + 1} y="114" width="1" height="1" fill="#ffe28a" />
            </g>
          ))}
        </g>
      )}

      {/* the field (stage 0/1: a single tilled block; 2+: a full farm) */}
      {stage <= 1 && <rect x="150" y="120" width="10" height="10" fill="url(#px-farm)" />}
      {stage >= 2 && Array.from({ length: FARM_BLOCKS }, (_, i) => (
        <rect key={i} x={FARM_X + i * 10} y="120" width="10" height="10" fill={WATER_AT.includes(i) ? 'url(#px-water)' : 'url(#px-farm)'} />
      ))}

      {/* stage 0: seed */}
      {stage === 0 && (
        <g {...hot('Seed', 'Every world starts with one verified deed. Join a campaign and watch it sprout.')}>
          <g className="mc-bob">
            <rect x="152" y="110" width="7" height="10" fill="#7a5230" /><rect x="153" y="108" width="5" height="2" fill="#7a5230" /><rect x="154" y="107" width="3" height="1" fill="#7a5230" />
            <rect x="153" y="111" width="2" height="4" fill="#a8794a" /><rect x="157" y="116" width="1" height="3" fill="#5a3a22" />
          </g>
          <rect className="mc-twinkle" x="148" y="108" width="2" height="2" fill="#ffe28a" /><rect className="mc-twinkle" style={{ animationDelay: '1s' }} x="162" y="106" width="2" height="2" fill="#ffe28a" />
          <rect x="130" y="108" width="2" height="12" fill="#b8945f" /><rect x="122" y="102" width="18" height="8" fill="url(#px-planks)" />
        </g>
      )}

      {/* stage 1: sprout + a little rain cloud */}
      {stage === 1 && (
        <g {...hot('Small plant', 'Your first verified hours watered this little plant.')}>
          <g transform={`translate(155 120) scale(1 ${sproutScale}) translate(-155 -120)`}>
            <rect x="154" y="98" width="3" height="22" fill="#4d8f2f" />
            <rect x="145" y="104" width="9" height="4" fill="#5fb03a" /><rect x="145" y="104" width="9" height="1" fill="#8ad45f" />
            <rect x="157" y="97" width="10" height="4" fill="#5fb03a" /><rect x="157" y="97" width="10" height="1" fill="#8ad45f" />
            <rect x="152" y="92" width="6" height="6" fill="#6cc04a" /><rect x="153" y="93" width="2" height="2" fill="#a6e27d" />
          </g>
          <g fill="#fff"><rect x="138" y="72" width="14" height="6" /><rect x="132" y="78" width="28" height="6" /></g>
          {[0, 1, 2].map((i) => <rect key={i} className="mc-drop" style={{ animationDelay: `${i * 0.33}s` }} x={138 + i * 9} y="86" width="1" height="3" fill="#4a7be0" />)}
        </g>
      )}

      {/* stage 2+: wheat, scarecrow, fence */}
      {stage >= 2 && (
        <g>
          {cropSlots.filter((i) => planted.has(i)).map((i) => (
            <g key={i} className="mc-sway" style={{ animationDelay: `${(i % 4) * 0.4}s` }} onClick={() => harvest(FARM_X + i * 10)} role="button" tabIndex={0}
              aria-label="Wheat. Tap to harvest" onKeyDown={(e) => { if (e.key === 'Enter') harvest(FARM_X + i * 10) }}>
              <Wheat x={FARM_X + i * 10} ripe={i % 3} h={cropH} />
            </g>
          ))}
          <g {...hot('Scarecrow', 'Keeps the crows away. It arrives when your world becomes a farm.')}>
            <rect x="154" y="100" width="2" height="20" fill="#8a6a3a" /><rect x="147" y="105" width="16" height="2" fill="#8a6a3a" />
            <rect x="150" y="105" width="10" height="7" fill="#7aa6d8" /><rect x="152" y="108" width="6" height="1" fill="#5f8fc4" />
            <rect x="152" y="96" width="6" height="6" fill="#e0862b" /><rect x="153" y="98" width="1" height="1" fill="#3a2a22" /><rect x="156" y="98" width="1" height="1" fill="#3a2a22" />
            <rect x="150" y="94" width="10" height="2" fill="#3a2a22" /><rect x="152" y="91" width="6" height="3" fill="#3a2a22" />
          </g>
          {[96, 222].map((x) => (
            <g key={x}><rect x={x} y="108" width="3" height="12" fill="url(#px-planks)" /><rect x={x - (x < 150 ? 8 : -3)} y="111" width="8" height="2" fill="#9a7a49" /><rect x={x - (x < 150 ? 8 : -3)} y="116" width="8" height="2" fill="#9a7a49" /></g>
          ))}
        </g>
      )}
      {bursts.map((b) => (
        <g key={b.k} transform={`translate(${b.x + 5} 108)`}>
          {[[-8, -10], [8, -12], [-3, -16], [4, -6]].map(([dx, dy], i) => (
            <rect key={i} className="mc-burst" style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px` }} width="2" height="2" fill={i % 2 ? '#ffd23f' : '#7efc20'} />
          ))}
        </g>
      ))}

      {/* stage 3+: barn, hay, farmer */}
      {stage >= 3 && (
        <g>
          <g {...hot('Barn', careStation ? 'Your blood donation stocked its community care station.' : 'Donate blood through a verified health partner and the barn gains a community care station.')}>
            <rect x="240" y="80" width="60" height="40" fill="url(#px-barn)" />
            <rect x="236" y="70" width="68" height="10" fill="url(#px-roof)" />
            <rect x="246" y="60" width="48" height="10" fill="url(#px-roof)" />
            <rect x="256" y="50" width="28" height="10" fill="url(#px-roof)" />
            <rect x="240" y="80" width="60" height="2" fill="#f1e8dc" />
            <rect x="262" y="62" width="10" height="8" fill="#2a1a14" /><rect x="261" y="61" width="12" height="1" fill="#f1e8dc" />
            <rect x="260" y="92" width="22" height="28" fill="url(#px-planks)" />
            <rect x="258" y="90" width="26" height="2" fill="#f1e8dc" /><rect x="258" y="90" width="2" height="30" fill="#f1e8dc" /><rect x="282" y="90" width="2" height="30" fill="#f1e8dc" />
            <line x1="260" y1="92" x2="282" y2="120" stroke="#f1e8dc" strokeWidth="2" /><line x1="282" y1="92" x2="260" y2="120" stroke="#f1e8dc" strokeWidth="2" />
            {careStation && <g><rect x="244" y="96" width="12" height="12" fill="#f4f1ea" /><rect x="249" y="98" width="2" height="8" fill="#d83a34" /><rect x="246" y="101" width="8" height="2" fill="#d83a34" /></g>}
          </g>
          <g {...hot('Hay bales', 'Stored harvest for the barn.')}>
            <rect x="304" y="110" width="10" height="10" fill="url(#px-hay)" /><rect x="304" y="100" width="10" height="10" fill="url(#px-hay)" />
          </g>
          <g {...hot('Farmer', 'Your caretaker. They tend the field while you are out helping others.')}>
            <g className="mc-walk"><g transform="translate(112 120)"><g className="mc-flip" style={{ transformOrigin: '0px 0px' }}>
              <g className="mc-legA"><rect x="-3" y="-5" width="3" height="5" fill="#3b4f8a" /></g>
              <g className="mc-legB"><rect x="0" y="-5" width="3" height="5" fill="#2f4170" /></g>
              <rect x="-3" y="-11" width="6" height="6" fill="#b8352f" /><rect x="-3" y="-9" width="6" height="1" fill="#8e2420" />
              <rect x="-2" y="-9" width="4" height="4" fill="#3b4f8a" /><rect x="-1" y="-8" width="1" height="1" fill="#e3c565" /><rect x="1" y="-8" width="1" height="1" fill="#e3c565" />
              <g className="mc-armA" style={{ transformOrigin: '-4px -11px' }}><rect x="-5" y="-11" width="2" height="6" fill="#b8352f" /><rect x="-5" y="-5" width="2" height="1" fill="#e8b48f" /></g>
              <g className="mc-armB" style={{ transformOrigin: '4px -11px' }}><rect x="3" y="-11" width="2" height="6" fill="#9c2c27" /><rect x="3" y="-5" width="2" height="1" fill="#e8b48f" />
                <rect x="5" y="-8" width="4" height="3" fill="#8a8f99" /><rect x="9" y="-9" width="2" height="1" fill="#8a8f99" />
                <rect className="mc-drop" x="11" y="-8" width="1" height="2" fill="#4a7be0" /><rect className="mc-drop" style={{ animationDelay: '.4s' }} x="10" y="-8" width="1" height="2" fill="#4a7be0" /></g>
              <rect x="-3" y="-17" width="6" height="6" fill="#e8b48f" /><rect x="-3" y="-17" width="6" height="1" fill="#4a3220" />
              <rect x="-2" y="-14" width="1" height="1" fill="#2b1d16" /><rect x="1" y="-14" width="1" height="1" fill="#2b1d16" /><rect x="-1" y="-12" width="2" height="1" fill="#b3745a" />
              <rect x="-5" y="-18" width="10" height="2" fill="#e3c565" /><rect x="-3" y="-21" width="6" height="3" fill="#d6b24a" /><rect x="-3" y="-19" width="6" height="1" fill="#b8352f" />
            </g></g></g>
          </g>
          <g><rect x="233" y="100" width="2" height="20" fill="#5a3a22" /><rect x="231" y="96" width="6" height="6" fill="#ffd23f" />
            {night && <rect className="mc-glow" x="229" y="94" width="10" height="10" fill="#ffd23f" opacity=".35" />}</g>
        </g>
      )}

      {/* stage 4: chickens + birds */}
      {stage >= 4 && (
        <g>
          {[226, 88].map((x, i) => (
            <g key={x} {...hot('Chicken', 'Chickens only move in once your world thrives.')}>
              <g transform={`translate(${x} 120)`}><g className="mc-chicken" style={{ animationDelay: `${i * 1.3}s` }}>
                <rect x="0" y="-6" width="7" height="5" fill="#f4f1ea" /><rect x="5" y="-9" width="4" height="4" fill="#f4f1ea" /><rect x="6" y="-10" width="2" height="1" fill="#d83a34" />
                <rect x="9" y="-8" width="2" height="1" fill="#f0a030" /><rect x="6" y="-8" width="1" height="1" fill="#222" />
                <rect x="1" y="-1" width="1" height="1" fill="#f0a030" /><rect x="5" y="-1" width="1" height="1" fill="#f0a030" />
              </g></g>
            </g>
          ))}
          {[[0, 26], [-120, 46]].map(([dx, y], i) => (
            <g key={i} className="mc-bird" style={{ animationDelay: `${i * -14}s` }}><g transform={`translate(0 ${y})`} fill={night ? '#9aa6d6' : '#35506b'}>
              <rect x="0" y="0" width="2" height="1" /><rect x="2" y="1" width="2" height="1" /><rect x="4" y="0" width="2" height="1" /><rect x="6" y="1" width="2" height="1" /><rect x="8" y="0" width="2" height="1" />
            </g></g>
          ))}
        </g>
      )}

      {night && <rect x="0" y="0" width="320" height="180" fill="#0b1030" opacity=".22" pointerEvents="none" />}
    </svg>
  )
}
