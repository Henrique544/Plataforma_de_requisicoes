require('dotenv').config();
const connectDB = require('./config/db.js');
const mongoose = require('mongoose');
const User = require('./models/User');
const Material = require('./models/Material');

const seed = async () => {
  await connectDB();

  console.log('A criar utilizadores...');

  // Admin
  const adminExists = await User.findOne({ email: 'aerdlyoutube@aerdl.eu' }); 
  if (!adminExists) {
    await User.create({
      nome: 'Administrador',
      email: 'aerdlyoutube@aerdl.eu', 
      password: 'aerdlyoutube2526!!!',    //   MUDAR ANTES DE PUBLICAR
      telemovel: '.',
      role: 'admin',
      escola: 'rainha',
      numero: 'ADM001'
    });
    console.log('  ✓ Admin criado: aerdlyoutube@aerdl.eu / aerdlyoutube2526!!!  (atenção mudar a password depois) ');  //   MUDAR ANTES DE PUBLICAR
  } else {
    console.log('Admin já existe');
  }

  const admin = await User.findOne({ email: 'aerdlyoutube@aerdl.eu' });

  console.log('\nA criar materiais...');
const u = (codigos) => codigos.map(c => ({ codigo: c, status: 'disponivel' }));

  const materiaisSample = [
    { nome: 'Kit de Chroma Key',           descricao: 'Kit de Chroma Key c/ 5 fundos coloridos e sistema de iluminação',      categoria: 'Multimédia',              quantidade: 1,  icone: '🟩',  status: 'disponivel', unidades: u(['Kc01']) },
    { nome: 'Mesa de Mistura de Vídeo',    descricao: 'Mesa de mistura multi-formato HD - Roland V-02HD',                     categoria: 'Multimédia',              quantidade: 1,  icone: '🎛️', status: 'disponivel', unidades: u(['Mmvm01']) },
    { nome: 'Placa de Captura de Vídeo',   descricao: 'Placa de captura de video HDMI-USB',                                   categoria: 'Multimédia',              quantidade: 2,  icone: '📼',  status: 'disponivel', unidades: [] },
    { nome: 'Controlador de Streaming',    descricao: 'Controlador Deck Stream',                                              categoria: 'Multimédia',              quantidade: 1,  icone: '🎛️', status: 'disponivel', unidades: u(['Cds01']) },
    { nome: 'Mesa de Mistura de Áudio',    descricao: 'Mesa de mistura com 2 colunas Yamaha Stagepas 400BT',                  categoria: 'Multimédia',              quantidade: 1,  icone: '🎚️', status: 'disponivel', unidades: u(['Mma01']) },
    { nome: 'Máquina Fotográfica Bridge',  descricao: 'PANASONIC Lumix DC-FZ82EG-K',                                          categoria: 'Multimédia',              quantidade: 2,  icone: '📷',  status: 'disponivel', unidades: u(['Mfb01', 'Mfb02']) },
    { nome: 'Microfone Externo para Câmara', descricao: 'Microfone direcional para câmara fotográfica',                       categoria: 'Multimédia',              quantidade: 2,  icone: '🎤',  status: 'disponivel', unidades: u(['Mpc01', 'Mpc02']) },
    { nome: 'Câmara de Vídeo 4K',          descricao: 'SONY FDR-AX53 BOSS 4K Ultra HD',                                      categoria: 'Multimédia',              quantidade: 1,  icone: '🎥',  status: 'disponivel', unidades: u(['CvSONY01']) },
    { nome: 'Teleponto',                   descricao: 'Datavideo Teleponto TP-500 DSLR Prompter',                             categoria: 'Multimédia',              quantidade: 1,  icone: '📺',  status: 'disponivel', unidades: u(['Dtp01']) },
    { nome: 'Tripé Traveler',              descricao: 'BRESSER TR-688V com Cabeça Giratória',                                 categoria: 'Multimédia',              quantidade: 3,  icone: '🔭',  status: 'disponivel', unidades: u(['Tripe01', 'Tripe02', 'Tripe03']) },
    { nome: 'Kit Microfones sem Fios Lapela', descricao: 'Saramonic Blink 500 B2 / Kit Genérico',                             categoria: 'Multimédia',              quantidade: 2,  icone: '🎙️', status: 'disponivel', unidades: u(['Msfb01', 'KMSFL01']) },
    { nome: 'Microfone com Fios e Tripé',  descricao: 'Shure SM58 - Set',                                                     categoria: 'Multimédia',              quantidade: 2,  icone: '🎙️', status: 'disponivel', unidades: u(['Mft01', 'Mft02']) },
    { nome: 'Gravador de Áudio',           descricao: 'Zoom H5 c/ cartão SD de 32 GB',                                       categoria: 'Multimédia',              quantidade: 1,  icone: '⏺️', status: 'disponivel', unidades: u(['Grav01']) },
    { nome: 'Mesa Digitalizadora',         descricao: 'WACOM M com Caneta 4K Intuos, Bluetooth',                              categoria: 'Multimédia',              quantidade: 5,  icone: '✍️',  status: 'disponivel', unidades: u(['Mdc01', 'Mdc02', 'Mdc03', 'Mdc04', 'Mdc05']) },
    { nome: 'Impressora 3D',               descricao: 'Blocks One MkII Modular',                                              categoria: 'Multimédia',              quantidade: 1,  icone: '🖨️', status: 'disponivel', unidades: u(['Impre3D01']) },
    { nome: 'Consumíveis Impressora 3D',   descricao: 'Filamentos diversos 1kg',                                              categoria: 'Multimédia',              quantidade: 3,  icone: '🧵',  status: 'disponivel', unidades: u(['Cdi3d01', 'Cdi3d02', 'Cdi3d03']) },
    { nome: 'Carregador para Portátil',    descricao: 'Boltx0505 CLASSMATE PC',                                               categoria: 'Multimédia',              quantidade: 12, icone: '🔌',  status: 'disponivel', unidades: u(['CPBCP01','CPBCP02','CPBCP03','CPBCP04','CPBCP05','CPBCP06','CPBCP07','CPBCP08','CPBCP09','CPBCP10','CPBCP11','CPBCP12']) },
    { nome: 'Auscultadores',               descricao: 'Auscutadores Vox505 / Roland RH-5',                                    categoria: 'Multimédia',              quantidade: 5,  icone: '🎧',  status: 'disponivel', unidades: u(['AV01', 'AV02', 'AV03', 'AV04', 'ARH5']) },
    { nome: 'Disco Externo SSD',           descricao: 'Samsung Portable SSD T7',                                              categoria: 'Multimédia',              quantidade: 1,  icone: '💾',  status: 'disponivel', unidades: u(['SPSSDT01']) },
    { nome: 'Dock Station USB-C',          descricao: 'ewent USB-C to Multiport Dock 8 in 1',                                 categoria: 'Multimédia',              quantidade: 1,  icone: '🔌',  status: 'disponivel', unidades: u(['euda']) },

    { nome: 'Portátil de Elevada Performance', descricao: 'Computadores de alta performance para programação',                categoria: 'Programação e Robótica',  quantidade: 12, icone: '💻',  status: 'disponivel', unidades: u(['Pep01','Pep02','Pep03','Pep04','Pep05','Pep06','Pep07','Pep08','Pep09','Pep10','Pep11','Pep12']) },
    { nome: 'Kit Micro:bit Inventor v2',   descricao: "BBC Micro:bit Inventor's Kit com Acessórios",                          categoria: 'Programação e Robótica',  quantidade: 25, icone: '📟',  status: 'disponivel', unidades: u(['Mbik01','Mbik02','Mbik03','Mbik04','Mbik05','Mbik06','Mbik07','Mbik08','Mbik09','Mbik10','Mbik11','Mbik12','Mbik13','Mbik14','Mbik15','Mbik016','Mbik017','Mbik18','Mbik19','Mbik20','Mbik21','Mbik22','Mbik23','Mbik24','Mbik25']) },
    { nome: 'Kit 37 Sensores para Micro:bit', descricao: 'KEYESTUDIO KS0361 - Sensores e Atuadores',                          categoria: 'Programação e Robótica',  quantidade: 10, icone: '🔌',  status: 'disponivel', unidades: u(['KSM01','KSM02','KSM03','KSM04','KSM05','KSM06','KSM07','KSM08','KSM09','KSM10']) },
    { nome: 'Kit Iniciação Arduino UNO',   descricao: 'Desenvolvimento e iniciação à eletrónica compatível com Arduino UNO Rev3', categoria: 'Programação e Robótica', quantidade: 15, icone: '🤖', status: 'disponivel', unidades: u(['Kdie01','Kdie02','Kdie03','Kdie04','Kdie05','Kdie06','Kdie07','Kdie08','Kdie09','Kdie10','Kdie11','Kdie12','Kdie13','Kdie14','Kdie15']) },
    { nome: 'Kit 37 Sensores Arduino/Raspberry Pi', descricao: 'Sensores avançados compatíveis com Arduino e Raspberry Pi',   categoria: 'Programação e Robótica',  quantidade: 15, icone: '🌡️', status: 'disponivel', unidades: u(['Kscar01','Kscar02','Kscar03','Kscar04','Kscar05','Kscar06','Kscar07','Kscar08','Kscar09','Kscar10','Kscar11','Kscar12','Kscar13','Kscar14','Kscar15']) },
    { nome: 'Kit Domótica Educacional',    descricao: 'KEYESTUDIO KS0085 para Arduino c/ estrutura em madeira',               categoria: 'Programação e Robótica',  quantidade: 5,  icone: '🏠',  status: 'disponivel', unidades: u(['KDEA01(20241401637)','KDEA02(20241401639)','KDEA03(20241401855)','KDEA04(20241401640)','KDEA05(20241401856)']) },
    { nome: 'LEGO Education SPIKE Prime Set', descricao: 'Kit de robótica e programação LEGO base',                           categoria: 'Programação e Robótica',  quantidade: 4,  icone: '🧱',  status: 'disponivel', unidades: u(['LESps01','LESps02','LESps03','LESps04']) },
    { nome: 'LEGO SPIKE Conjunto de Expansão', descricao: 'Kit de expansão SPIKE com 603 peças',                              categoria: 'Programação e Robótica',  quantidade: 2,  icone: '🧩',  status: 'disponivel', unidades: u(['CeK01','CeK02']) },
    { nome: 'Placa Protótipo Photoshield', descricao: 'Mini placa de ensaio compatível com Arduino Uno',                      categoria: 'Programação e Robótica',  quantidade: 5,  icone: '🧰',  status: 'disponivel', unidades: u(['Ppp01','Ppp02','Ppp03','Ppp04','Ppp05']) },
    { nome: 'Placa Shield LCD para Arduino', descricao: 'Interface LCD Velleman KA06',                                        categoria: 'Programação e Robótica',  quantidade: 5,  icone: '🖥️', status: 'disponivel', unidades: u(['PdsLCD01','PdsLCD02','PdsLCD03','PdsLCD04','PdsLCD05']) },
    { nome: 'Placa Shield Motor L293Dx2',  descricao: 'Interface de interligação com Motor',                                  categoria: 'Programação e Robótica',  quantidade: 10, icone: '⚙️',  status: 'disponivel', unidades: u(['PdsM01','PdsM02','PdsM03','PdsM04','PdsM05','PdsM06','PdsM07','PdsM08','PdsM09','PdsM10']) },
    { nome: 'Placa Expansão Multifunções', descricao: 'Compatível com Arduino Velleman VMA209',                               categoria: 'Programação e Robótica',  quantidade: 5,  icone: '🎛️', status: 'disponivel', unidades: u(['Pemc01','Pemc02','Pemc03','Pemc04','Pemc05']) },

    { nome: 'Mbot Explorer Kit',           descricao: 'Makeblock com Display para programação em bloco e C',                  categoria: 'STEM',                    quantidade: 13, icone: '🤖',  status: 'disponivel', unidades: u(['Mek01','Mek02','Mek03','Mek04','Mek05','Mek06','Mek07','Mek08','Mek09','Mek10','Mek11','Mek12','Mekone01']) },
    { nome: 'Bateria Lítio para MBot',     descricao: 'Bateria 3,7v 1800mah c/ JST ph2',                                     categoria: 'STEM',                    quantidade: 2,  icone: '🔋',  status: 'disponivel', unidades: u(['BatMbot01','BatMbot02']) },
    { nome: 'Módulos Makeblock Extra',     descricao: 'Sensores variados (Som, Gás, Temp, Humidade, Cor, Luz, Movimento)',    categoria: 'STEM',                    quantidade: 14, icone: '🔌',  status: 'disponivel', unidades: u(['Mbss01','Mbss02','Mbsg01','Mbsg02','Mbsth01','Mbsth02','Mbsc01','Mbsc02','Mbsts01','Mbsts02','Mbsm01','Mbsm02','Mbsl01','Mbsl02']) },
    { nome: 'Microscópio Ótico c/ Câmara Digital', descricao: 'Microscópio B-190TB didático de laboratório',                 categoria: 'STEM',                    quantidade: 2,  icone: '🔬',  status: 'disponivel', unidades: u(['Micro01','Micro02']) },
    { nome: 'Câmara Ocular',               descricao: 'Optika Câmera C-B1, color, CMOS 1.3 MP USB2.0',                       categoria: 'STEM',                    quantidade: 2,  icone: '📷',  status: 'disponivel', unidades: u(['Opcm01','Opcm02']) },
    { nome: 'TI-Innovator Hub',            descricao: 'Com TI LaunchPad Board para recolha de dados STEM',                   categoria: 'STEM',                    quantidade: 7,  icone: '🧮',  status: 'disponivel', unidades: u(['Tiib01','Tiib02','Tiib03','Tiib04','Tiib05','Tiib06','Tiib07']) },
    { nome: 'TI-Innovator Rover',          descricao: 'Robot motorizado para cálculo e programação STEM',                    categoria: 'STEM',                    quantidade: 7,  icone: '🚗',  status: 'disponivel', unidades: u(['Tiir01','Tiir02','Tiir03','Tiir04','Tiir05','Tiir06','Tiir07']) },
    { nome: 'Laboratório Energias Renováveis', descricao: 'Kits experimentais de energias limpas',                           categoria: 'STEM',                    quantidade: 10, icone: '☀️',  status: 'disponivel', unidades: u(['Ler01','Ler02','Ler03','Ler04','Ler05','Ler06','Ler07','Ler08','Ler09','Ler10']) },
    { nome: 'TI-Innovator Technology',     descricao: 'Módulos tecnológicos adicionais',                                     categoria: 'STEM',                    quantidade: 1,  icone: '🔌',  status: 'disponivel', unidades: u(['Titec01']) },

    { nome: 'Tripé para Câmara Sony',      descricao: 'Tripé de suporte específico para câmara Sony',                         categoria: 'Multimédia',              quantidade: 1,  icone: '🔭',  status: 'disponivel', unidades: u(['TCS01']) },
    { nome: 'Luz para Estúdio',            descricao: 'Iwata Genius Light - iluminação forte para estúdio',                   categoria: 'Multimédia',              quantidade: 1,  icone: '💡',  status: 'disponivel', unidades: u(['Usbcmd01']) },
    { nome: 'Softboxes de Iluminação',     descricao: 'Softboxes de iluminação para estúdio fotográfico',                     categoria: 'Multimédia',              quantidade: 2,  icone: '💡',  status: 'disponivel', unidades: u(['SBIDE01', 'SBIDE02']) },
    { nome: 'Guarda-Chuvas Fotográficos',  descricao: 'Guarda-chuvas fotográficos de iluminação para estúdio',                categoria: 'Multimédia',              quantidade: 2,  icone: '☂️',  status: 'disponivel', unidades: u(['GCFIPE_01', 'GCFIPE_02']) },
    { nome: 'Estabilizador 4K',            descricao: 'Fellwordl 4K Super Light com ecrã e estabilizador',                    categoria: 'Multimédia',              quantidade: 2,  icone: '🎥',  status: 'disponivel', unidades: u(['fe4slece01', 'fe4slece02']) },
    { nome: 'Adaptador HDTV',             descricao: 'Adaptador HDTV',                                                        categoria: 'Multimédia',              quantidade: 1,  icone: '🔌',  status: 'disponivel', unidades: u(['ha']) },
    { nome: 'Saco de Transporte Som',      descricao: 'Saco de transporte de equipamento de som',                             categoria: 'Multimédia',              quantidade: 1,  icone: '🎒',  status: 'disponivel', unidades: u(['STES']) },
    { nome: 'Saco de Transporte Câmara Sony', descricao: 'Saco de transporte da câmara Sony',                                 categoria: 'Multimédia',              quantidade: 1,  icone: '🎒',  status: 'disponivel', unidades: u(['STCS']) },
    { nome: 'Saco de Transporte Câmara Canon', descricao: 'Saco de transporte da câmara Canon',                               categoria: 'Multimédia',              quantidade: 1,  icone: '🎒',  status: 'disponivel', unidades: u(['STCC']) },

    { nome: 'Caixas de Equipamentos Robótica', descricao: 'Caixas de armazenamento para equipamentos de Programação e Robótica', categoria: 'Programação e Robótica', quantidade: 5, icone: '📦', status: 'disponivel', unidades: u(['Caixa01', 'Caixa02', 'Caixa03', 'Caixa04', 'Caixa05']) },
    { nome: 'Sensor de Temperatura DS18B20', descricao: 'Temperature Sensor Waterproof DS18B20',                               categoria: 'Programação e Robótica',  quantidade: 5,  icone: '🌡️', status: 'disponivel', unidades: u(['Tsw01', 'Tsw02', 'Tsw03', 'Tsw04', 'Tsw05']) },
  ];

  const existingCount = await Material.countDocuments();
  if (existingCount === 0) {
    for (const m of materiaisSample) {
      await Material.create({
        ...m,
        escola: 'rainha',
        quantidadeDisponivel: m.quantidade,
        criadoPor: admin._id
      });

      let qtd2 = m.quantidade;
      if (m.categoria === 'Multimédia') {
        qtd2 = m.quantidade * 2;
      } else if (m.categoria === 'STEM') {
        qtd2 = Math.max(1, Math.floor(m.quantidade / 2));
      }

      let unidades2 = m.unidades || [];
      if (m.categoria === 'Multimédia' && unidades2.length > 0) {
        const extra = unidades2.map(u2 => ({ codigo: u2.codigo + '_B', status: 'disponivel' }));
        unidades2 = [...unidades2, ...extra];
      } else if (m.categoria === 'STEM' && unidades2.length > 0) {
        unidades2 = unidades2.slice(0, qtd2);
      }

      await Material.create({
        ...m,
        escola: 'eugenio',
        quantidade: qtd2,
        quantidadeDisponivel: qtd2,
        unidades: unidades2,
        criadoPor: admin._id
      });

      console.log(`  ✓ ${m.nome}  (rainha: ${m.quantidade} | eugenio: ${qtd2})`);
    }
  } else {
    console.log('Materiais já existem, a saltar...');
  }

  console.log('\n✅ Seed completo!');
  await mongoose.disconnect();
};

seed().catch(err => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
