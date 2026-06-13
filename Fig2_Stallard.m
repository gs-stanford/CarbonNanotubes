%==========================================================================
% stallard_strengthdensity.m
%
% Created on Fri Apr 22 20:00:00 2025
%==========================================================================

% Clear workspace and figures
clear; close all; clc;

% Material property arrays
%x axis kg/m^3, y axis MPa
array_yarn_density        = [1033, 670, 670, 670, 800, 780, 385, 643, 800, 500, 900, 550, 730, 1000, 1240];
array_yarn_strength       = [690, 190.4, 127.5, 173.6, 850, 350, 630, 1100, 354, 350, 1250, 175, 418, 830, 772];

array_sheet_density       = [1.5, 500, 840, 1040, 840, 600, 900, 675, 1210, 1350];
array_sheet_strength      = [0.198, 232.5, 1561, 3206, 76, 500, 1500, 1000, 2500, 3080];

array_crosslinked_density = [706.78, 672.27, 746.13, 605.58, 320, 420, 550, 750, 1000];
array_crosslinked_strength= [390, 350, 370, 310, 38.4, 222.6, 385, 427.5, 330];

bucky_density             = [600, 600, 900, 640, 500, 800, 1000, 420, 270];
bucky_strength            = [6, 15, 30, 16, 12.5, 23, 20, 3.4, 3];

foam_density              = [7.5, 5.8, 7.3, 11.6, 4, 3.8, 9.2];
foam_strength             = [0.018, 0.005, 0.012, 0.01, 0.006, 0.003, 0.01];

forest_density            = [280, 65, 17, 500, 31, 530, 29, 570, 43.5, 950, 80, 80, 38.94, 220, 8, 15, 200, 22, 15, 15];
forest_strength           = [12, 14, 0.18, 16, 0.18, 18, 0.327, 27.8, 4, 360, 3, 3, 1, 0.1, 0.021, 0.117, 9.997, 1, 0.015, 0.6];

spunyarns_density         = [1550, 420, 1000, 10, 1000, 2000, 950, 550, 1830, 2000, 1151, 543, 1592, 543, 0.92, 1000, 407, 663.5, 1163, 698, 410];
spunyarns_strength        = [3750, 174, 1101, 5.65, 1000, 1400, 1045, 550, 1347, 1100, 970, 339.5, 3542, 189, 0.068, 1500, 256.37, 219, 1000, 349, 266];

spunsheets_density        = [1670, 566, 735, 882, 970, 560, 400, 189, 470, 370, 807, 1300, 380, 500, 510, 470, 580, 480, 440, 370, 470, 530, 680, 980, 800, 1300];
spunsheets_strength       = [112, 89.4, 187, 323.7, 83, 50, 37, 127, 184.2, 63.4, 209, 350, 45.32, 25.26, 20.36, 29.8, 97.76, 63.88, 72.24, 85.84, 186, 307, 416, 598, 750, 300];

wetspun_density           = [870, 1000, 1000, 1000, 1300, 1100, 1100];
wetspun_strength          = [116, 65, 105, 52, 1000, 50, 20];

records_density           = [1400, 1710, 1400, 1400];
records_strength          = [5800, 3840, 3220, 8200];

%Non-CNT Materials
metal_density             = [8960, 2700, 7850]; %Cu, Al, ASTM A36
metal_strength            = [340, 120, 480];

CF_density                = [1800]; %Toray T1100GB
CF_strength               = [7500];

% Marker size
ms = 10;

% Create figure (size in centimeters)
fig=figure('Units','centimeters','Position',[5 5 12 12], ... 
'Color','none', 'InvertHardcopy','off');
hold on;

% Plot each dataset
scatter(array_yarn_density,        array_yarn_strength,        ms, 'o', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(array_sheet_density,       array_sheet_strength,       ms, '^', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(array_crosslinked_density, array_crosslinked_strength, ms, 's', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(bucky_density,             bucky_strength,             ms, 'p', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(foam_density,              foam_strength,              ms, 'v', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(forest_density,            forest_strength,            ms, 'h', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(spunyarns_density,         spunyarns_strength,         ms, 'd', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(spunsheets_density,        spunsheets_strength,        ms, '*', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(wetspun_density,           wetspun_strength,           ms, '>', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(records_density,           records_strength,           2*ms, 'd', 'MarkerEdgeColor','k','MarkerFaceColor','none');
%% Non-CNT Fibers
scatter(metal_density,             metal_strength,             ms, 's', 'MarkerEdgeColor','k','MarkerFaceColor','none');
scatter(CF_density,                CF_strength,                ms, 's', 'MarkerEdgeColor','k','MarkerFaceColor','none');

% Log–log scale
set(gca, 'XScale', 'log', 'YScale', 'log','Color','none');

% Grid on (major and minor)
%grid on;
%grid minor;

box on;
% Axis limits
xlim([0.05, 9900]);
ylim([1e-3, 1e4]);

% Axes styling
set(gca, ...
    'LineWidth', 1, ...               % Border thickness
    'TickDir', 'in', ...              % Tick direction
    'TickLength', [0.015 0.005], ...  % Major and minor tick length
    'FontSize', 11, ...               % Tick label font size
    'FontName', 'Helvetica' ...       % Font family
);

% Labels
xlabel('Density, \rho (kg/m^3)', 'FontSize', 11, 'FontName', 'Helvetica');
ylabel('Strength, \sigma (MPa)',   'FontSize', 11, 'FontName', 'Helvetica');

% Tight layout
set(gca,'LooseInset', max(get(gca,'TightInset'), 0.02));

print(fig, 'Fig2_Strength_Rho1.svg', '-dsvg');

% Save as SVG at 900 dpi
%print(gcf, 'stallard_strengthdensity.svg', '-dsvg', '-r900');

hold off;
