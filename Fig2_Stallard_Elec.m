%==========================================================================
% Fig2_Conductivity_Density.m
%==========================================================================

% Clear workspace and figures
clear; close all; clc;

% Density (kg/m^3) and Electrical Conductivity (S/cm) arrays
array_yarn_density        = [800,   800,  385,  643];
array_yarn_elcond         = [303,   325,  667,  885];

array_sheet_density       = [1.5,   840];
array_sheet_elcond        = [0.14,  70];

array_crosslinked_density = [];
array_crosslinked_elcond  = [];

bucky_density             = [800, 350, 900, 540, 640, 1000, 1000, 600, 420, 270];
bucky_elcond              = [62.5,5000,1000,150,247,150,330,1098,117,45];

foam_density              = [7.5,   7.3,  9.9,   9.3,  9.8,  9.8,  8.9,  8,    231, 143, 139, 28,  30,  33,  43.5, ...
                             54,    61,   62,    41.1, 32.2, 4,    44,   54,   57];
foam_elcond               = [1.67,  0.0489,0.181, 1.96, 0.885,0.291, 1.78, 0.122,8.1,  5.3,  5,    1.12,77,84, ...
                             14,    16,   19,    25,   0.075,0.028,0.032,0.012,0.069,0.025];

forest_density            = [31,   570,  36,   43.5, 220, 1260, 165];
forest_elcond             = [0.04, 114,  5.6,  0.16, 3.63, 660,  20];

spunyarns_density         = [1550,1000,1830,2000,543,0.92,1000,663.5,698,650];
spunyarns_elcond          = [20450,8000,5000,1905.5,510,1.8,8000,400,7042,9500];

spunsheets_density        = [1670,6.5,50,970,560,400,300,470,370,807,1190,1600,1300,1950];
spunsheets_elcond         = [800,113.76,50,419,273,217,1250,625,8.75,3636,1998,4666,2026,13000];

wetspun_density           = [1000,1000,1000,1300,1400,1100,870,1110,1110,1330,1460,1212,1212];
wetspun_elcond            = [147,170,90,380,635,20,1,9,23,100,420,331,314];
%Recent record conductivities
records_density           = [1920,1410];
records_elcond            = [10.88e6/1e2,24500];  % = 108800 S/cm and 24.5 MS/m

%Non-CNT Materials
metal_density             = [8960, 2700, 7850]; %Cu, Al, ASTM A36
metal_elcond              = [58820, 35710, 5900];

CF_density                = [2200]; %Dialead K13D2U
CF_elcond                 = [670];



% Convert S/cm → S/m
conv = 100;

array_yarn_elcond         = array_yarn_elcond * conv;
array_sheet_elcond        = array_sheet_elcond * conv;
array_crosslinked_elcond  = array_crosslinked_elcond * conv;
bucky_elcond              = bucky_elcond * conv;
foam_elcond               = foam_elcond * conv;
forest_elcond             = forest_elcond * conv;
spunyarns_elcond          = spunyarns_elcond * conv;
spunsheets_elcond         = spunsheets_elcond * conv;
wetspun_elcond            = wetspun_elcond * conv;
records_elcond            = records_elcond * conv;
metal_elcond              = metal_elcond * conv;
CF_elcond                 = CF_elcond * conv;

% Marker size (points^2)
ms = 10;

% Create figure (same style as Fig2_Stallard)
fig = figure('Units','centimeters','Position',[5 5 12 12], ...
             'Color','none','InvertHardcopy','off');
hold on;

% Plot each dataset
scatter(array_yarn_density,        array_yarn_elcond,        ms, 'o', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(array_sheet_density,       array_sheet_elcond,       ms, '^', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(array_crosslinked_density, array_crosslinked_elcond, ms, 's', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(bucky_density,             bucky_elcond,             ms, 'p', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(foam_density,              foam_elcond,              ms, 'v', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(forest_density,            forest_elcond,            ms, 'h', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(spunyarns_density,         spunyarns_elcond,         ms, 'd', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(spunsheets_density,        spunsheets_elcond,        ms, '*', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(wetspun_density,           wetspun_elcond,           ms, '>', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(records_density,           records_elcond,           ms, 'd', 'MarkerEdgeColor','k','MarkerFaceColor','none');
%% Non-CNT Fibers
scatter(metal_density,             metal_elcond,             ms, 's', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(CF_density,                CF_elcond,                ms, 's', 'MarkerEdgeColor','k','MarkerFaceColor','none');

% Log–log scale
set(gca, 'XScale','log', 'YScale','log', 'Color','none');

% Styling
box on;
%grid on;    % Uncomment to enable major grid
%grid minor; % Uncomment to enable minor grid

% Axis limits
xlim([0.05, 9900]);
ylim([1e0, 7e6]);

set(gca, ...
    'LineWidth',    1, ...               % Border thickness
    'TickDir',      'in', ...            % Tick direction
    'TickLength',   [0.015 0.005], ...   % Major/minor tick lengths
    'FontSize',     11, ...              % Tick label font size
    'FontName',     'Helvetica' ...      % Font family
);

% Labels
xlabel('Density, \rho (kg/m^3)',            'FontSize',11,'FontName','Helvetica');
ylabel('Electrical Conductivity (S/m)',    'FontSize',11,'FontName','Helvetica');

% Tight layout
set(gca, 'LooseInset', max(get(gca,'TightInset'), 0.02));

% Export as SVG
print(fig, 'Fig2_Conductivity_Density.svg', '-dsvg');

hold off;
