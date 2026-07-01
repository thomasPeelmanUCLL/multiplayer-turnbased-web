{
  description = "multiplayer-turnbased-web dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            nodePackages.pnpm
            docker-compose
            # optional but useful
            postgresql_16  # gives you psql CLI for debugging
          ];

          shellHook = ''
            echo "node  $(node --version)"
            echo "pnpm  $(pnpm --version)"
          '';
        };
      });
}
