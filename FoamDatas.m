function [ FoamVec ] = FoamDatas()

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% DATA FROM CARBON NANOTUBE FOAMS: REVIEW BY STEFANIA NARDECCHIA ET AL.   %
% "Three dimensional macroporous architectures and aerogels built of      %
% carbon nanotubes and/or graphene: synthesis and applications".          %
% Chem. Soc. Rev., 2013, 42, 794.                                         %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

FoamVec   = zeros(100,7);

% FoamVec is [ Density (kg/m3), Strength (MPa), Stiffness (GPa), 
% Ductility (%), Energy to Failure (MJ/m^3), 
% Electrical Conductivity (s/cm), Thermal Conductivity (W/mk);

% Cao, Dickrell et al. "Super-compressible foamlike carbon nanotube films"
% Science, 310. Great look at 440 references!

% X. Gui ... D. Wu. "Carbon nanotube sponges". Adv. Mater, 2010.
% CVD synthesised CNT sponge.

FoamVec(1,1) = 7.5;     FoamVec(1,2) = 0.018;   FoamVec(1,3) = 0.0002;
FoamVec(1,6) = 1.67;    FoamVec(1,7) = 0.15;

% Gui, Wu. "Soft, highly conductive carbon nanotube sponges and composites
% with controlled compressibility". 

FoamVec(2,1) = 5.8;     FoamVec(2,2) = 0.005;   FoamVec(2,3) = 0.00004;
FoamVec(3,1) = 7.3;     FoamVec(3,2) = 0.012;   FoamVec(3,3) = 0.0001;
FoamVec(3,6) = 0.0489;
FoamVec(4,1) = 11.6;    FoamVec(4,2) = 0.01;    FoamVec(4,3) = 0.00015;
FoamVec(5,1) = 12.8;                            FoamVec(5,3) = 0.0000714;
FoamVec(6,1) = 25.5;                            FoamVec(6,3) = 0.0001;

% R. Kohlmeyer ... Jian Chen. "Preparation of stable carbon nanotube
% aerogels with high electrical conductivity and porosity". Carbon 49
% (2011) pp. 2352-2361.

FoamVec(7,1)  = 9.9;    FoamVec(7,6)  = 0.181;
FoamVec(8,1)  = 9.3;    FoamVec(8,6)  = 1.96;
FoamVec(9,1)  = 9.8;    FoamVec(9,6)  = 0.885;
FoamVec(10,1) = 9.8;    FoamVec(10,6) = 0.291;
FoamVec(11,1) = 8.9;    FoamVec(11,6) = 1.78;
FoamVec(12,1) = 8.0;    FoamVec(12,6) = 0.122;

% Worsley ... Baumann. "Synthesis and characterisation of monolithic carbon
% aerogel nanocomposites containing double-walled carbon nanotubes".
% Langmuir (2008 24, pp. 9763-9766. Low density carbon aerogel
% nanocomposites with dwnts:

FoamVec(13,1) = 231;    FoamVec(13,6) = 8.1;
FoamVec(14,1) = 143;    FoamVec(14,6) = 5.3;
FoamVec(15,1) = 139;    FoamVec(15,6) = 5.0;

% Worsley ... Baumann. "Carbon scaffolds for stiff and highly conductive
% monolithic oxide-carbon nanotube composites"

    % SWNT-CA 55% wt.
FoamVec(16,1) = 28;                             FoamVec(16,3) = 0.0012;
FoamVec(16,6) = 1.12;
    % SWNT-TiO2 23% wt.
FoamVec(17,1) = 108;                            FoamVec(17,3) = 0.0149;

% Worsley ... Baumann. "Mechanically robust and electrically conductive
% carbon nanotube foams", Appl. Phys. Lett. (2009) 94, 073115.
% Carbon nanoparticles used as a binder to crosslink randomly oriented
% bundles of swnts.

FoamVec(18,1) = 30;                     FoamVec(18,6) = 77;
FoamVec(19,1) = 33;                     FoamVec(19,6) = 84;
FoamVec(20,1) = 43.5;                   FoamVec(20,6) = 14;
FoamVec(21,1) = 54;                     FoamVec(21,6) = 16;
FoamVec(22,1) = 61;                     FoamVec(22,6) = 19;
FoamVec(23,1) = 62;                     FoamVec(23,6) = 25;

% Worsley ... Baumann. "Properties of single-walled carbon nanotube-based
% aerogels as a function of nanotube loading". Acta Materialia 57 (2009),
% pp. 5131-5136.

FoamVec(24,1) = 28;                     FoamVec(24,6) = 1.12;

% Zhuyn Sui ... Bing Cao. "Green synthesis of carbon nanotube-graphene
% hybrid aerogels and their use as versatile agents for water
% purification". Journal of Materials Chemistry (2012) 22, 8767.

    % Graphene-MWNT aerogel:
FoamVec(25,1) = 41.1;                   FoamVec(25,6) = 0.075;
    % Graphene-C-MWNT aerogel:
FoamVec(26,1) = 32.2;                   FoamVec(26,6) = 0.028;

% Zou ... Zhai. "Ultralight multiwalled carbon nanotube aerogel"

FoamVec(27,1) = 4.0;    FoamVec(27,2) = 0.006;  FoamVec(27,3) = 0.0000147;
FoamVec(27,6) = 0.032;

% Zhang ... Luo. "Ultralight conducting polymer/carbon nanotube composite
% aerogels". Carbon 49 (2011) pp. 1884-1893.

FoamVec(28,1) = 44;                             FoamVec(28,6) = 0.012;
FoamVec(29,1) = 54;                             FoamVec(29,6) = 0.069;
FoamVec(30,1) = 57;                             FoamVec(30,6) = 0.025;

% Weinde ... Zhang ... T. Lu. "Growth of carbon nanotubes on clay: unique
% nanostructured filler for high-performance polymer nanocomposites"
% Interesting clay-based CNT composites worthy of some attention...

% Yufeng Luo, Shu Luo, Hengcai Wu, Mengya Li, Ke Wang, Lingjia Yan, 
% Kaili Jiang, Qunqing Li, Shoushan Fan, Jiaping Wang. "Self-expansion
% construction of ultralight carbon nanotube aerogels with a 3D and 
% hierarchical cellular structure". Small, 13 (2017), 1700966.

FoamVec(31,1) = 0.12;						FoamVec(31,3) = 0.00000211;

% Shaghayegh Faraji, Kelly L. Stano, Ozkan Yildiz, Ang Li, Yuntian Zhu, 
% Philip D. Bradford. 
% "Ultralight anisotropic foams from layered aligned carbon nanotube sheets"
% Nanoscale 7 (2015), 17038.

FoamVec(32,1) = 3.8;	FoamVec(32,2) = 0.003;		FoamVec(32,3) = 0.000016;
FoamVec(32,7) = 0.107;
FoamVec(33,1) = 3.8;
FoamVec(33,7) = 0.026;

FoamVec(34,1) = 9.2;	FoamVec(34,2) = 0.01;		FoamVec(34,3) = 0.000075;
FoamVec(34,7) = 0.133;
FoamVec(35,1) = 9.2;
FoamVec(35,7) = 0.027;

end

